import { Workflow, WorkflowNode, WorkflowEdge } from '../src/types/index.ts';

export interface ValidationError {
  nodeId?: string;
  field?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export function validateWorkflowDAG(workflow: Pick<Workflow, 'nodes' | 'edges'>): ValidationResult {
  const errors: ValidationError[] = [];
  const { nodes, edges } = workflow;

  if (!nodes || nodes.length === 0) {
    return {
      valid: false,
      errors: [{ message: 'Workflow must contain at least one node.' }],
    };
  }

  // 1. Check for START and END nodes
  const startNodes = nodes.filter(n => n.type === 'START');
  const endNodes = nodes.filter(n => n.type === 'END');

  if (startNodes.length === 0) {
    errors.push({ message: 'Workflow must have at least one START node.' });
  } else if (startNodes.length > 1) {
    errors.push({ message: 'Workflow cannot have more than one START node.' });
  }

  if (endNodes.length === 0) {
    errors.push({ message: 'Workflow must have at least one END node.' });
  }

  const nodeMap = new Map<string, WorkflowNode>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  // 2. Validate Edge connections
  const adjacencyList = new Map<string, string[]>();
  const reverseAdjacency = new Map<string, string[]>();
  nodes.forEach(n => {
    adjacencyList.set(n.id, []);
    reverseAdjacency.set(n.id, []);
  });

  for (const edge of edges) {
    if (!nodeMap.has(edge.source)) {
      errors.push({ message: `Edge refers to non-existent source node: ${edge.source}` });
      continue;
    }
    if (!nodeMap.has(edge.target)) {
      errors.push({ message: `Edge refers to non-existent target node: ${edge.target}` });
      continue;
    }
    if (edge.source === edge.target) {
      errors.push({
        nodeId: edge.source,
        message: `Self-referential loop detected on node '${nodeMap.get(edge.source)?.data.label || edge.source}'.`,
      });
      continue;
    }

    adjacencyList.get(edge.source)!.push(edge.target);
    reverseAdjacency.get(edge.target)!.push(edge.source);
  }

  // 3. Cycle Detection using DFS (White-Gray-Black coloring)
  const visited = new Map<string, number>(); // 0: unvisited, 1: visiting (in stack), 2: visited
  const parentMap = new Map<string, string>();
  let cycleFound = false;

  function dfsCycle(nodeId: string, path: string[]) {
    visited.set(nodeId, 1);
    path.push(nodeId);

    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      const state = visited.get(neighbor) || 0;
      if (state === 1) {
        // Cycle found!
        cycleFound = true;
        const cycleStartIndex = path.indexOf(neighbor);
        const cycleNodes = path.slice(cycleStartIndex).map(id => nodeMap.get(id)?.data.label || id);
        cycleNodes.push(nodeMap.get(neighbor)?.data.label || neighbor);
        errors.push({
          nodeId: neighbor,
          message: `Workflow contains a circular dependency cycle: ${cycleNodes.join(' → ')}. DAGs must be strictly acyclic.`,
        });
        return;
      }
      if (state === 0) {
        dfsCycle(neighbor, path);
        if (cycleFound) return;
      }
    }

    path.pop();
    visited.set(nodeId, 2);
  }

  nodes.forEach(n => visited.set(n.id, 0));
  for (const node of nodes) {
    if ((visited.get(node.id) || 0) === 0) {
      dfsCycle(node.id, []);
      if (cycleFound) break;
    }
  }

  // 4. Reachability from START
  if (startNodes.length === 1) {
    const reachable = new Set<string>();
    const queue = [startNodes[0].id];
    reachable.add(startNodes[0].id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = adjacencyList.get(current) || [];
      for (const next of neighbors) {
        if (!reachable.has(next)) {
          reachable.add(next);
          queue.push(next);
        }
      }
    }

    // Check for unreachable orphan nodes
    for (const node of nodes) {
      if (node.id !== startNodes[0].id && !reachable.has(node.id)) {
        errors.push({
          nodeId: node.id,
          message: `Node '${node.data.label || node.id}' is disconnected and not reachable from START node.`,
        });
      }
    }
  }

  // 5. Node-Specific Validations
  for (const node of nodes) {
    const label = node.data.label || node.id;

    if (node.type === 'START') {
      const incoming = reverseAdjacency.get(node.id) || [];
      if (incoming.length > 0) {
        errors.push({ nodeId: node.id, message: `START node cannot have incoming edges.` });
      }
    } else if (node.type === 'END') {
      const outgoing = adjacencyList.get(node.id) || [];
      if (outgoing.length > 0) {
        errors.push({ nodeId: node.id, message: `END node cannot have outgoing edges.` });
      }
    } else if (node.type === 'HTTP_REQUEST') {
      if (!node.data.url) {
        errors.push({ nodeId: node.id, field: 'url', message: `HTTP node '${label}' requires a target URL.` });
      } else {
        try {
          new URL(node.data.url);
        } catch {
          errors.push({ nodeId: node.id, field: 'url', message: `HTTP node '${label}' has an invalid URL format.` });
        }
      }
      if (!node.data.method) {
        errors.push({ nodeId: node.id, field: 'method', message: `HTTP node '${label}' requires an HTTP method.` });
      }
    } else if (node.type === 'CONDITION') {
      const outgoing = edges.filter(e => e.source === node.id);
      const trueEdge = outgoing.find(e => e.sourceHandle === 'true' || e.label === 'True' || e.label === 'true');
      const falseEdge = outgoing.find(e => e.sourceHandle === 'false' || e.label === 'False' || e.label === 'false');

      if (outgoing.length < 2 || !trueEdge || !falseEdge) {
        errors.push({
          nodeId: node.id,
          message: `CONDITION node '${label}' must connect to both a TRUE branch and a FALSE branch.`,
        });
      }
      if (!node.data.conditionField) {
        errors.push({
          nodeId: node.id,
          field: 'conditionField',
          message: `CONDITION node '${label}' requires a condition field to evaluate.`,
        });
      }
    } else if (node.type === 'TRANSFORM') {
      if (!node.data.transformScript || node.data.transformScript.trim() === '') {
        errors.push({
          nodeId: node.id,
          field: 'transformScript',
          message: `TRANSFORM node '${label}' requires a JavaScript transformation function.`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
