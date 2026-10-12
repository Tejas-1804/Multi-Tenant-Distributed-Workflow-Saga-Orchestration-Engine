# REST API Documentation

## Authentication
- `POST /api/auth/register`: Create user & tenant account
- `POST /api/auth/login`: Authenticate and receive JWT token
- `GET /api/auth/me`: Fetch authenticated user profile & tenant quota

## Workflows
- `GET /api/workflows`: List workflows for current tenant
- `POST /api/workflows`: Create new workflow DAG
- `GET /api/workflows/:id`: Retrieve workflow definition
- `PUT /api/workflows/:id`: Update workflow graph (increments version)
- `DELETE /api/workflows/:id`: Remove workflow
- `POST /api/workflows/:id/validate`: Run DAG cycle detection & validation
- `POST /api/workflows/:id/execute`: Asynchronously launch workflow run

## Executions
- `GET /api/executions`: Query execution traces with status filtering
- `GET /api/executions/:id`: Fetch discrete node execution status & payload tree
- `POST /api/executions/:id/cancel`: Terminate running workflow

## Dead Letter Queue (DLQ)
- `GET /api/dlq`: List failed tasks exceeding retry limits
- `POST /api/dlq/:id/retry`: Replay DLQ payload into execution state machine
- `DELETE /api/dlq/:id`: Discard DLQ entry

## API Keys
- `GET /api/api-keys`: List tenant keys
- `POST /api/api-keys`: Generate key (displays raw secret once)
- `DELETE /api/api-keys/:id`: Revoke key
- `POST /api/api-keys/:id/rotate`: Rotate key with replacement

## Admin & Telemetry
- `GET /api/admin/statistics`: Cluster execution stats & worker latency
- `GET /api/admin/workers`: Fleet health & load
