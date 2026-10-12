# Saga Orchestration Pattern

## Overview
Traditional distributed transactions rely on 2-Phase Commit (2PC) protocols, which introduce distributed locks, high latency, and single points of failure across microservices.

The Saga Pattern structures distributed transactions as a sequence of discrete local transactions:
- **Forward Actions**: $T_1, T_2, T_3, \dots, T_n$
- **Compensating Actions**: $C_1, C_2, C_3, \dots, C_{n-1}$

If transaction $T_k$ fails, the Saga engine runs compensating actions in reverse order:
$$C_{k-1}, C_{k-2}, \dots, C_1$$

## Implementation Details
1. **Compensatable Nodes**: Nodes declare optional compensation handlers (`enabled: true`, `name`, `method`, `url`, `bodyTemplate`).
2. **Reverse Order Traversal**: The engine checks which nodes executed successfully, inverts the topological array (LIFO), and sequentially fires compensations.
3. **Dead Letter Queue Integration**: The failed job $T_k$ is saved in the DLQ with full payload context so administrators can debug and re-run.
