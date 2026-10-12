# System Architecture

## Distributed Workflow Execution Lifecycle

1. **Client Submission**: Client invokes `POST /api/workflows/:id/execute` with an input payload.
2. **DAG Compilation & Validation**: The graph is checked for cycles, dead ends, and required node inputs.
3. **Execution Record**: An execution instance is persisted in the database with status `RUNNING`.
4. **Worker Dispatch**: Ready nodes are submitted to the asynchronous Worker Pool.
5. **Real-Time WebSocket Emission**: The engine broadcasts `NODE_STATUS_CHANGED` to subscribed tenant clients.
6. **Error Interception**: If a node fails, the retry engine checks if the error is retryable and applies exponential backoff with jitter.
7. **Saga Coordinator**: If retries are exhausted, the node is flagged `FAILED`, the job payload is transferred to the Dead Letter Queue (DLQ), and the Saga coordinator executes rollbacks in reverse topological order.
8. **Final State**: The transaction closes with either `SUCCESS`, `COMPENSATED`, or `FAILED`.
