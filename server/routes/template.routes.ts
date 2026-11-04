import { Router } from 'express';
import { db } from '../db.ts';
import { authenticateUser, identifyTenant, AuthenticatedRequest } from '../middleware.ts';
import { WorkflowTemplate } from '../../src/types/index.ts';

const router = Router();

export const SAMPLE_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'tpl-order-processing',
    name: 'E-Commerce Order Fulfillment & Saga',
    category: 'E-Commerce',
    description: 'Complete order fulfillment pipeline with inventory check, payment capture, and automated rollback if stock is insufficient.',
    tags: ['E-Commerce', 'Saga', 'Payment', 'Inventory'],
    nodesCount: 6,
    estimatedRuntime: '1.2s - 2.5s',
    workflow: {
      nodes: [
        {
          id: 'n-trigger',
          type: 'START',
          position: { x: 250, y: 50 },
          data: { label: 'Trigger', description: 'New Order Webhook / Cart Checkout' },
        },
        {
          id: 'n-validate',
          type: 'TRANSFORM',
          position: { x: 250, y: 160 },
          data: { label: 'Validate Order', description: 'Check cart schema, fraud score, and user tokens' },
        },
        {
          id: 'n-inventory',
          type: 'HTTP_REQUEST',
          position: { x: 250, y: 280 },
          data: { label: 'Check Inventory', description: 'Query stock levels from inventory services' },
        },
        {
          id: 'n-payment',
          type: 'HTTP_REQUEST',
          position: { x: 100, y: 420 },
          data: { label: 'Process Payment', description: 'Authorize card and capture funds via Stripe gateway' },
        },
        {
          id: 'n-update-inv',
          type: 'HTTP_REQUEST',
          position: { x: 100, y: 540 },
          data: { label: 'Update Inventory', description: 'Decrement reserved stock in warehouse ERP' },
        },
        {
          id: 'n-notify',
          type: 'LOG',
          position: { x: 400, y: 420 },
          data: { label: 'Send Notification', description: 'Alert customer of out-of-stock items via email/SMS' },
        },
      ],
      edges: [
        { id: 'e1', source: 'n-trigger', target: 'n-validate' },
        { id: 'e2', source: 'n-validate', target: 'n-inventory' },
        { id: 'e3', source: 'n-inventory', target: 'n-payment', label: 'In Stock' },
        { id: 'e4', source: 'n-inventory', target: 'n-notify', label: 'Out of Stock' },
        { id: 'e5', source: 'n-payment', target: 'n-update-inv' },
      ],
    },
  },
  {
    id: 'tpl-payment-processing',
    name: 'Payment Processing & Invoicing',
    category: 'Finance',
    description: 'Capture subscription charges, generate PDF invoices, and trigger ERP revenue recognition hooks.',
    tags: ['Billing', 'Stripe', 'PDF Invoicing'],
    nodesCount: 5,
    estimatedRuntime: '800ms',
    workflow: {
      nodes: [
        { id: 'p1', type: 'START', position: { x: 250, y: 50 }, data: { label: 'Invoice Due Trigger' } },
        { id: 'p2', type: 'HTTP_REQUEST', position: { x: 250, y: 160 }, data: { label: 'Charge Customer' } },
        { id: 'p3', type: 'TRANSFORM', position: { x: 250, y: 270 }, data: { label: 'Generate PDF Receipt' } },
        { id: 'p4', type: 'HTTP_REQUEST', position: { x: 250, y: 380 }, data: { label: 'Sync QuickBooks' } },
        { id: 'p5', type: 'END', position: { x: 250, y: 490 }, data: { label: 'Payment Settled' } },
      ],
      edges: [
        { id: 'ep1', source: 'p1', target: 'p2' },
        { id: 'ep2', source: 'p2', target: 'p3' },
        { id: 'ep3', source: 'p3', target: 'p4' },
        { id: 'ep4', source: 'p4', target: 'p5' },
      ],
    },
  },
  {
    id: 'tpl-user-registration',
    name: 'User Registration & KYC Onboarding',
    category: 'User Ops',
    description: 'Multi-step customer onboarding with email verification, fraud screening, and welcome drip sequence.',
    tags: ['Auth', 'KYC', 'Security'],
    nodesCount: 5,
    estimatedRuntime: '1.5s',
    workflow: {
      nodes: [
        { id: 'u1', type: 'START', position: { x: 250, y: 50 }, data: { label: 'Sign-up Submitted' } },
        { id: 'u2', type: 'HTTP_REQUEST', position: { x: 250, y: 160 }, data: { label: 'Verify Identity (KYC)' } },
        { id: 'u3', type: 'TRANSFORM', position: { x: 250, y: 270 }, data: { label: 'Assign Roles & Permissions' } },
        { id: 'u4', type: 'LOG', position: { x: 250, y: 380 }, data: { label: 'Dispatch Welcome Email' } },
        { id: 'u5', type: 'END', position: { x: 250, y: 490 }, data: { label: 'Onboarding Complete' } },
      ],
      edges: [
        { id: 'eu1', source: 'u1', target: 'u2' },
        { id: 'eu2', source: 'u2', target: 'u3' },
        { id: 'eu3', source: 'u3', target: 'u4' },
        { id: 'eu4', source: 'u4', target: 'u5' },
      ],
    },
  },
  {
    id: 'tpl-inventory-sync',
    name: 'Real-time Multi-Warehouse Inventory Sync',
    category: 'E-Commerce',
    description: 'Poll ERP endpoints, balance distributed warehouse counts, and publish updates to storefronts.',
    tags: ['Warehouse', 'ERP', 'Catalog'],
    nodesCount: 4,
    estimatedRuntime: '2.1s',
    workflow: {
      nodes: [
        { id: 'i1', type: 'START', position: { x: 250, y: 50 }, data: { label: 'Scheduled Sync Trigger' } },
        { id: 'i2', type: 'HTTP_REQUEST', position: { x: 250, y: 160 }, data: { label: 'Pull Warehouse Delta' } },
        { id: 'i3', type: 'TRANSFORM', position: { x: 250, y: 270 }, data: { label: 'Reconcile Stock Allocations' } },
        { id: 'i4', type: 'END', position: { x: 250, y: 380 }, data: { label: 'Update Shopify/Amazon' } },
      ],
      edges: [
        { id: 'ei1', source: 'i1', target: 'i2' },
        { id: 'ei2', source: 'i2', target: 'i3' },
        { id: 'ei3', source: 'i3', target: 'i4' },
      ],
    },
  },
];

router.use(authenticateUser);

// List templates
router.get('/', (req: AuthenticatedRequest, res) => {
  return res.json(SAMPLE_TEMPLATES);
});

// Instantiate a template as a new workflow in the current tenant
router.post('/:id/instantiate', identifyTenant, (req: AuthenticatedRequest, res) => {
  const template = SAMPLE_TEMPLATES.find(t => t.id === req.params.id);
  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }

  const newWorkflow = db.workflows.create({
    tenantId: req.user!.tenantId,
    name: req.body.name || template.name,
    description: template.description,
    status: 'ACTIVE',
    createdBy: req.user!.email,
    nodes: template.workflow.nodes,
    edges: template.workflow.edges,
  });

  return res.status(201).json(newWorkflow);
});

export default router;
