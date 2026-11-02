import type { Workflow, WorkflowNode, WorkflowEdge } from '../src/types/index.ts';

export interface ValidationError {
  nodeId?: string;
  field?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export function validateWorkflowDAG(
  workflow: Pick<Workflow, 'nodes' | 'edges'>
): ValidationResult {
  const errors: ValidationError[] = [];
  const { nodes, edges } = workflow;

  // 1. Validate workflow structure
  if (!nodes || nodes.length === 0) {
    return {
      valid: false,
      errors: [{ message: 'Workflow must contain at least one node.' }],
    };
  }

  // 2. Check START and END nodes
  const startNodes = nodes.filter(node => node.type === 'START');
  const endNodes = nodes.filter(node => node.type === 'END');

  if (startNodes.length === 0) {
    errors.push({ message: 'Workflow must have at least one START node.' });
  } else if (startNodes.length > 1) {
    errors.push({ message: 'Workflow cannot have more than one START node.' });
  }

  if (endNodes.length === 0) {
    errors.push({ message: 'Workflow must have at least one END node.' });
  }

  // 3. Build node map and detect duplicate IDs
  const nodeMap = new Map<string, WorkflowNode>();

  for (const node of nodes) {
    if (nodeMap.has(node.id)) {
      errors.push({
        nodeId: node.id,
        message: `Duplicate node ID detected: '${node.id}'.`,
      });
    } else {
      nodeMap.set(node.id, node);
    }
  }

  // 4. Build adjacency lists
  const adjacencyList = new Map<string, Set<string>>();
  const reverseAdjacency = new Map<string, Set<string>>();
  const validEdges: WorkflowEdge[] = [];

  for (const nodeId of nodeMap.keys()) {
    adjacencyList.set(nodeId, new Set());
    reverseAdjacency.set(nodeId, new Set());
  }

  // 5. Validate edge connections
  for (const edge of edges) {
    if (!nodeMap.has(edge.source)) {
      errors.push({
        message: `Edge refers to non-existent source node: ${edge.source}`,
      });
      continue;
    }

    if (!nodeMap.has(edge.target)) {
      errors.push({
        message: `Edge refers to non-existent target node: ${edge.target}`,
      });
      continue;
    }

    if (edge.source === edge.target) {
      errors.push({
        nodeId: edge.source,
        message: `Self-referential loop detected on node '${nodeMap.get(edge.source)?.data.label || edge.source}'.`,
      });
      continue;
    }

    adjacencyList.get(edge.source)!.add(edge.target);
    reverseAdjacency.get(edge.target)!.add(edge.source);

    validEdges.push(edge);
  }

  // 6. Cycle detection using iterative DFS
  // 0 = Unvisited, 1 = Visiting, 2 = Visited
  const visited = new Map<string, number>();

  for (const nodeId of nodeMap.keys()) {
    visited.set(nodeId, 0);
  }

  let cycleFound = false;

  for (const rootId of nodeMap.keys()) {
    if (visited.get(rootId) !== 0 || cycleFound) {
      continue;
    }

    const path: string[] = [rootId];
    const pathIndex = new Map<string, number>([[rootId, 0]]);

    const stack: Array<{ nodeId: string; index: number }> = [
      { nodeId: rootId, index: 0 },
    ];

    visited.set(rootId, 1);

    while (stack.length > 0 && !cycleFound) {
      const current = stack[stack.length - 1];
      const neighbors = Array.from(adjacencyList.get(current.nodeId) || []);

      if (current.index >= neighbors.length) {
        visited.set(current.nodeId, 2);
        stack.pop();
        pathIndex.delete(current.nodeId);
        path.pop();
        continue;
      }

      const neighbor = neighbors[current.index];
      current.index++;

      const state = visited.get(neighbor) ?? 0;

      if (state === 1) {
        cycleFound = true;

        const cycleStart = pathIndex.get(neighbor) ?? 0;

        const cycleNodes = path
          .slice(cycleStart)
          .map(id => nodeMap.get(id)?.data.label || id);

        cycleNodes.push(
          nodeMap.get(neighbor)?.data.label || neighbor
        );

        errors.push({
          nodeId: neighbor,
          message: `Workflow contains a circular dependency cycle: ${cycleNodes.join(' → ')}. DAGs must be strictly acyclic.`,
        });

        break;
      }

      if (state === 0) {
        visited.set(neighbor, 1);
        pathIndex.set(neighbor, path.length);
        path.push(neighbor);

        stack.push({
          nodeId: neighbor,
          index: 0,
        });
      }
    }
  }

  // 7. Check reachability from START
  if (startNodes.length === 1) {
    const startId = startNodes[0].id;
    const reachable = new Set<string>([startId]);
    const queue: string[] = [startId];

    let queueIndex = 0;

    while (queueIndex < queue.length) {
      const current = queue[queueIndex++];

      for (const next of adjacencyList.get(current) || []) {
        if (!reachable.has(next)) {
          reachable.add(next);
          queue.push(next);
        }
      }
    }

    // Detect disconnected nodes
    for (const node of nodeMap.values()) {
      if (!reachable.has(node.id)) {
        errors.push({
          nodeId: node.id,
          message: `Node '${node.data.label || node.id}' is disconnected and not reachable from START node.`,
        });
      }
    }
  }

  // 8. Node-specific validations
  for (const node of nodeMap.values()) {
    const label = node.data.label || node.id;

    if (node.type === 'START') {
      const incoming = reverseAdjacency.get(node.id);

      if (incoming && incoming.size > 0) {
        errors.push({
          nodeId: node.id,
          message: 'START node cannot have incoming edges.',
        });
      }
    }

    else if (node.type === 'END') {
      const outgoing = adjacencyList.get(node.id);

      if (outgoing && outgoing.size > 0) {
        errors.push({
          nodeId: node.id,
          message: 'END node cannot have outgoing edges.',
        });
      }
    }

    else if (node.type === 'HTTP_REQUEST') {
      const url = node.data.url?.trim();

      if (!url) {
        errors.push({
          nodeId: node.id,
          field: 'url',
          message: `HTTP node '${label}' requires a target URL.`,
        });
      } else {
        try {
          const parsedUrl = new URL(url);

          if (
            parsedUrl.protocol !== 'http:' &&
            parsedUrl.protocol !== 'https:'
          ) {
            errors.push({
              nodeId: node.id,
              field: 'url',
              message: `HTTP node '${label}' must use HTTP or HTTPS.`,
            });
          }
        } catch {
          errors.push({
            nodeId: node.id,
            field: 'url',
            message: `HTTP node '${label}' has an invalid URL format.`,
          });
        }
      }

      if (!node.data.method?.trim()) {
        errors.push({
          nodeId: node.id,
          field: 'method',
          message: `HTTP node '${label}' requires an HTTP method.`,
        });
      }
    }

    else if (node.type === 'CONDITION') {
      const outgoing = validEdges.filter(
        edge => edge.source === node.id
      );

      const trueEdge = outgoing.find(edge => {
        const handle = edge.sourceHandle?.toLowerCase();
        const edgeLabel = edge.label?.toLowerCase();

        return handle === 'true' || edgeLabel === 'true';
      });

      const falseEdge = outgoing.find(edge => {
        const handle = edge.sourceHandle?.toLowerCase();
        const edgeLabel = edge.label?.toLowerCase();

        return handle === 'false' || edgeLabel === 'false';
      });

      if (!trueEdge || !falseEdge) {
        errors.push({
          nodeId: node.id,
          message: `CONDITION node '${label}' must connect to both a TRUE branch and a FALSE branch.`,
        });
      }

      if (!node.data.conditionField?.trim()) {
        errors.push({
          nodeId: node.id,
          field: 'conditionField',
          message: `CONDITION node '${label}' requires a condition field to evaluate.`,
        });
      }
    }

    else if (node.type === 'TRANSFORM') {
      if (
        !node.data.transformScript ||
        node.data.transformScript.trim() === ''
      ) {
        errors.push({
          nodeId: node.id,
          field: 'transformScript',
          message: `TRANSFORM node '${label}' requires a JavaScript transformation function.`,
        });
      }
    }
  }

  // 9. Return validation result
  return {
    valid: errors.length === 0,
    errors,
  };
}