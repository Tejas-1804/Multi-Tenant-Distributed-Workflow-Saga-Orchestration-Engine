# Security Architecture

1. **Authentication**: JWT signed with secret keys. Passwords hashed using bcrypt (10 rounds).
2. **API Keys**: Stored exclusively as SHA-256 hashes (`crypto.createHash('sha256')`). Raw key prefix `wk_live_` shown only once to user.
3. **Tenant Rate Limiting**: Sliding window rate limiter enforcing plan quotas (e.g., 100 req/min for Free, 1000 req/min for Pro). Exceeding quotas returns HTTP 429 with retry headers.
4. **Sandboxed Code Execution**: JavaScript user transformations run in Node.js VM isolated contexts with strict 2000ms timeouts and restricted globals, preventing malicious process manipulation.
5. **Role-Based Access Control**:
   - `SUPER_ADMIN`: Cluster management, cross-tenant inspection, system telemetry.
   - `TENANT_ADMIN`: Workflow creation/editing/execution, API key management, DLQ replays.
   - `TENANT_USER`: Workflow viewing and execution.
