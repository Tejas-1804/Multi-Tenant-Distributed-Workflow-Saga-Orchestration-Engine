import { Router } from 'express';
import { db } from '../db.ts';
import {
  authenticateUser,
  identifyTenant,
  authorizeRole,
  tenantRateLimiter,
  AuthenticatedRequest,
} from '../middleware.ts';
import { validateWorkflowDAG } from '../validator.ts';
import { workflowEngine } from '../engine/orchestrator.ts';

const router = Router();

// Apply auth, tenant identification and rate limiting to all workflow routes
router.use(authenticateUser);
router.use(identifyTenant);
router.use(tenantRateLimiter);

// 1. List workflows for current tenant
router.get('/', (req: AuthenticatedRequest, res) => {
  const workflows = db.workflows.find({ tenantId: req.user!.tenantId });
  return res.json(workflows);
});

// 2. Get workflow by ID
router.get('/:id', (req: AuthenticatedRequest, res) => {
  const workflow = db.workflows.findById(req.params.id, req.user!.tenantId);
  if (!workflow) {
    return res.status(404).json({ error: 'Workflow not found or belongs to another tenant' });
  }
  return res.json(workflow);
});

// 3. Create workflow
router.post('/', authorizeRole(['TENANT_ADMIN']), (req: AuthenticatedRequest, res) => {
  const { name, description = '', nodes = [], edges = [], status = 'DRAFT' } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Workflow name is required' });
  }

  const workflow = db.workflows.create({
    tenantId: req.user!.tenantId,
    name,
    description,
    nodes,
    edges,
    status,
    createdBy: req.user!.email,
  });

  db.auditLogs.create({
    tenantId: req.user!.tenantId,
    userId: req.user!.id,
    userEmail: req.user!.email,
    action: 'WORKFLOW_CREATED',
    resource: 'Workflow',
    resourceId: workflow.id,
    metadata: { name: workflow.name },
  });

  return res.status(201).json(workflow);
});

// 4. Update workflow
router.put('/:id', authorizeRole(['TENANT_ADMIN']), (req: AuthenticatedRequest, res) => {
  const { name, description, nodes, edges, status } = req.body;
  const existing = db.workflows.findById(req.params.id, req.user!.tenantId);
  if (!existing) {
    return res.status(404).json({ error: 'Workflow not found or belongs to another tenant' });
  }

  const updated = db.workflows.update(req.params.id, req.user!.tenantId, {
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description }),
    ...(nodes !== undefined && { nodes }),
    ...(edges !== undefined && { edges }),
    ...(status !== undefined && { status }),
  });

  db.auditLogs.create({
    tenantId: req.user!.tenantId,
    userId: req.user!.id,
    userEmail: req.user!.email,
    action: 'WORKFLOW_UPDATED',
    resource: 'Workflow',
    resourceId: req.params.id,
    metadata: { name: updated?.name, version: updated?.version },
  });

  return res.json(updated);
});

// 5. Delete workflow
router.delete('/:id', authorizeRole(['TENANT_ADMIN']), (req: AuthenticatedRequest, res) => {
  const existing = db.workflows.findById(req.params.id, req.user!.tenantId);
  if (!existing) {
    return res.status(404).json({ error: 'Workflow not found' });
  }

  const success = db.workflows.delete(req.params.id, req.user!.tenantId);
  if (!success) {
    return res.status(500).json({ error: 'Failed to delete workflow' });
  }

  db.auditLogs.create({
    tenantId: req.user!.tenantId,
    userId: req.user!.id,
    userEmail: req.user!.email,
    action: 'WORKFLOW_DELETED',
    resource: 'Workflow',
    resourceId: req.params.id,
  });

  return res.json({ message: 'Workflow deleted successfully' });
});

// 6. Validate workflow DAG
router.post('/:id/validate', (req: AuthenticatedRequest, res) => {
  const workflow = db.workflows.findById(req.params.id, req.user!.tenantId);
  if (!workflow) {
    return res.status(404).json({ error: 'Workflow not found' });
  }

  // Allow validating body nodes/edges if provided, or stored workflow
  const nodes = req.body.nodes || workflow.nodes;
  const edges = req.body.edges || workflow.edges;

  const result = validateWorkflowDAG({ nodes, edges });
  return res.json(result);
});

// 7. Validate ad-hoc DAG (before saving)
router.post('/validate-raw', (req: AuthenticatedRequest, res) => {
  const { nodes = [], edges = [] } = req.body;
  const result = validateWorkflowDAG({ nodes, edges });
  return res.json(result);
});

// 8. Execute workflow
router.post('/:id/execute', async (req: AuthenticatedRequest, res) => {
  try {
    const workflow = db.workflows.findById(req.params.id, req.user!.tenantId);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Verify DAG is valid before execution
    const validation = validateWorkflowDAG(workflow);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Cannot execute invalid workflow DAG.',
        validationErrors: validation.errors,
      });
    }

    const { inputPayload = {}, trigger = 'MANUAL' } = req.body;

    const execution = await workflowEngine.startExecution(
      workflow,
      inputPayload,
      req.user!.email,
      trigger
    );

    db.auditLogs.create({
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'WORKFLOW_EXECUTED',
      resource: 'WorkflowExecution',
      resourceId: execution.id,
      metadata: { workflowId: workflow.id, trigger },
    });

    return res.status(202).json({
      message: 'Workflow execution scheduled and started',
      executionId: execution.id,
      execution,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to start execution' });
  }
});

export default router;
