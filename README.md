# FlowForge — Enterprise Workflow Orchestration Engine

FlowForge is a multi-tenant visual workflow automation and DAG orchestration dashboard inspired by **Temporal** and **Zapier**. It features a directed acyclic graph (DAG) builder, real-time execution monitoring, exponential backoff with jitter, reverse-LIFO Saga compensations, and distributed worker tracking.

---

## Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │          FlowForge React SPA           │
                      │    (Visual DAG Builder, Live Trace)    │
                      └──────────────────┬─────────────────────┘
                                         │  HTTP / WebSocket (/ws)
                                         ▼
                      ┌────────────────────────────────────────┐
                      │         Express API Gateway            │
                      │ (Auth, RBAC, Rate Limiting, Tenancy)   │
                      └──────────────────┬─────────────────────┘
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   ▼                                           ▼
       ┌───────────────────────┐                   ┌───────────────────────┐
       │   Workflow Engine     │                   │  Change Stream / Bus  │
       │ (State Machine, DAG)  │                   │   (MongoDB / Redis)   │
       └───────────┬───────────┘                   └───────────────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
┌──────────────────┐┌──────────────────┐
│  Worker Pool     ││  Saga Coordinator│
│(VM Sandbox, HTTP)││(LIFO Rollbacks)  │
└────────┬─────────┘└────────┬─────────┘
         │                   │
         └─────────┬─────────┘
                   ▼
┌──────────────────────────────────────┐
│       Dead Letter Queue (DLQ)        │
│   (Max Attempt Exhaustion Store)     │
└──────────────────────────────────────┘
```

---

## 10 Dedicated Pages & Capabilities

1. **Dashboard**:
   - 4 Summary Cards: Total Workflows (24, ↑ 12%), Running (6, ↑ 50%), Completed (142, ↑ 18%), Failed (12, ↓ 8%).
   - 7-Day SVG Execution Chart with Failed, Running, and Successful curves.
   - Recent Executions list with duration and relative time.
   - Workflows by Status donut chart with center "24 Total".
   - System Health status panel (API Server, Database, Message Queue, Workers).
   - Active Tenants table (Acme Corp, TechNova, Global Systems, Quantum Dynamics, Helios Cloud).

2. **Workflows**:
   - Complete workflow catalog with search, status filtering, nodes count, and last run.
   - Actions: 1-Click Run, Edit in Builder, Duplicate, and Delete.

3. **Workflow Builder**:
   - Visual node-and-edge DAG editor powered by `@xyflow/react`.
   - Node Palette: Trigger, Validate Order, Check Inventory, Process Payment, Update Inventory, Send Notification.
   - Conditional branches with labels "In Stock" (green) and "Out of Stock" (red).
   - Cycle detection and topological graph validation before saving or running.
   - Direct Execution Modal with customizable input JSON.

4. **Executions**:
   - Trace list of executions with status pills, durations, and triggers.
   - Interactive Execution Detail page:
     - `Flow View` and `Execution Timeline` subtabs with zoom controls (`-`, `100%`, `+`, `⛶`).
     - Live execution DAG highlighting active node (Check Inventory running spinner).
     - "Current Step Details" with collapsible formatted Input/Output JSON code viewers.
     - "Execution Status" vertical stepper.
     - Actions: **Retry from Current Step**, **Cancel Execution**, and **View in Workflow**.

5. **Templates**:
   - Reusable blueprints catalog: E-Commerce Order Fulfillment, Payment Processing & Invoicing, User Onboarding & KYC, Multi-Warehouse Sync.
   - 1-Click "Use Template" instantiation into active tenant.

6. **Tenants**:
   - Strict multi-tenant isolation with custom subdomains (`acme.flowforge.com`).
   - Tenant Admins: Tejas, Amaan, Priyanka, and Rinkle Sharma.
   - Organization quota, rate limits, and instant workspace switcher.

7. **Workers**:
   - Fleet monitoring across geographical regions (US-East, EU-West, AP-South).
   - Live CPU percentage, memory utilization, active concurrent jobs, and latency.

8. **Monitoring**:
   - Detailed service latency telemetry (API Server 120ms, Database 45ms, Message Queue 32ms, Workers 98ms).
   - Ingestion throughput and queue backlog indicators.

9. **Alerts**:
   - Incident feed categorized by severity (Critical, Warning, Info).
   - Acknowledge and resolve workflow anomalies with live state updating.

10. **Settings**:
    - User profile details, workspace domain, subscription tiers.
    - Programmatic API key generation with secure SHA-256 hashing.
    - Alert notification threshold preferences.

---

## Quickstart & Local Setup

### Windows PowerShell

```powershell
# 1. Clone repository & enter workspace
git clone <repo-url> flowforge
cd flowforge

# 2. Install dependencies
npm install

# 3. Copy environment configuration
Copy-Item .env.example .env

# 4. Start FlowForge (Port 3000 serves both API and React frontend)
npm run dev
```

### Linux / macOS

```bash
# 1. Install dependencies
npm install

# 2. Copy environment configuration
cp .env.example .env

# 3. Start development server
npm run dev
```

Open your browser at `http://localhost:3000` (or `http://localhost:5174`).

---

## Automated Verification Suite

Run the full automated test suite verifying cycle detection, retry backoff with jitter, sandboxed execution, and API key hashing:

```bash
npx tsx test/workflow-engine.test.ts
```

Output:
```
🧪 Starting Workflow & Saga Engine Automated Test Suite...
[1] Cycle Detection & DAG Validation Tests:
  ✅ PASS: Cyclic workflow rejected as invalid
  ✅ PASS: Cycle error accurately identifies circular dependency
  ✅ PASS: Valid acyclic DAG passes validation with zero errors
[2] Retry & Exponential Backoff Engine Tests:
  ✅ PASS: Attempt 1 runs immediately without backoff
  ✅ PASS: Attempt 2 backoff is ~1000ms (+jitter)
  ✅ PASS: Attempt 3 backoff is ~2000ms (+jitter)
  ✅ PASS: Attempt 4 backoff is ~4000ms (+jitter)
  ✅ PASS: HTTP 503 Service Unavailable recognized as retryable
  ✅ PASS: Network timeout recognized as retryable
  ✅ PASS: HTTP 400 Bad Request is non-retryable client error
[3] Sandboxed Transform Node Security Tests:
  ✅ PASS: Sandboxed script executes successfully
  ✅ PASS: Transform output calculated accurately
  ✅ PASS: Infinite loop terminated safely via execution timeout
[4] Security & API Key Hashing Tests:
  ✅ PASS: API key generated with standard enterprise prefix
  ✅ PASS: SHA-256 hash matches verification algorithm
  ✅ PASS: Raw secret is never stored directly
==============================================
Test Results: 16 passed, 0 failed.
==============================================
```

---

## API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Authenticate user credentials & issue JWT |
| `POST` | `/api/auth/register` | Register new user & provision tenant |
| `GET` | `/api/auth/me` | Fetch active user profile and tenant |
| `GET` | `/api/tenants` | List all accessible tenants & domains |
| `POST` | `/api/tenants` | Provision new tenant organization |
| `GET` | `/api/workflows` | List workflows in active tenant |
| `POST` | `/api/workflows` | Create new workflow DAG |
| `GET` | `/api/workflows/:id` | Get workflow definition & nodes |
| `PUT` | `/api/workflows/:id` | Update workflow nodes & edges |
| `DELETE`| `/api/workflows/:id` | Delete workflow |
| `POST` | `/api/workflows/:id/execute` | Trigger workflow execution |
| `POST` | `/api/workflows/validate-raw` | Validate DAG acyclicity & structure |
| `GET` | `/api/executions` | List executions in tenant |
| `GET` | `/api/executions/:id` | Get execution flow & node step details |
| `POST` | `/api/executions/:id/retry` | Retry execution from current step |
| `POST` | `/api/executions/:id/cancel` | Cancel running execution |
| `GET` | `/api/templates` | List reusable workflow templates |
| `POST` | `/api/templates/:id/instantiate` | Instantiate template as workflow |
| `GET` | `/api/workers` | Get worker fleet metrics |
| `GET` | `/api/monitoring/health` | Get service health & p99 latencies |
| `GET` | `/api/alerts` | List system & workflow alerts |
| `POST` | `/api/alerts/:id/resolve` | Resolve alert incident |
| `GET` | `/api/api-keys` | List tenant API keys |
| `POST` | `/api/api-keys` | Generate new API key |
| `GET` | `/api/dlq` | List Dead Letter Queue unresolved jobs |
| `GET` | `/api/health` | Global health status check |
