# Testing Guide

## Running the Automated Test Suite
```bash
npx tsx test/workflow-engine.test.ts
```

## Key Test Cases
1. **Cycle Detection**: Validates that circular loops (e.g. A → B → C → A) are correctly caught and rejected by the DAG validation engine.
2. **Topological Order**: Validates that node dependencies execute sequentially and conditional branches follow the resolved edge.
3. **Exponential Backoff**: Tests delay formula $T_{backoff} = T_{initial} \times \text{multiplier}^{(\text{attempt}-2)}$ with jitter.
4. **Saga Compensations**: Verifies that when a node throws a fatal error, completed compensatable nodes execute in reverse order.
5. **Multi-Tenant Isolation**: Verifies that a tenant's request cannot access resources with foreign `tenantId` values.
