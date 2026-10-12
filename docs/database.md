# Database Schema & Isolation

## Multi-Tenancy Architecture
Every collection in the database adheres to mandatory tenant partition:
- `tenantId` is an indexed query constraint on every tenant-owned document.
- Queries always filter by `req.user.tenantId`.
- Super Administrators can optionally inspect arbitrary tenants via `x-target-tenant-id` header.

## Collections
1. **Tenant**: Organization profile, subscription plan (`FREE`, `PRO`, `ENTERPRISE`), rate limit per minute.
2. **User**: Name, email, hashed credentials, role (`SUPER_ADMIN`, `TENANT_ADMIN`, `TENANT_USER`).
3. **Workflow**: Versioned graph metadata, nodes, edges, createdBy.
4. **WorkflowExecution**: Run status, start/complete timestamps, context variables, compensations array.
5. **WorkflowNodeExecution**: Step status, attempts count, node outputs, execution log trail.
6. **APIKey**: Name, keyPrefix, keyHash (SHA-256), lastUsedAt, revokedAt.
7. **DeadLetterJob**: Failed node payload, attempt count, stack trace, status.
8. **AuditLog**: Immutable action record, actor email, target resource.
