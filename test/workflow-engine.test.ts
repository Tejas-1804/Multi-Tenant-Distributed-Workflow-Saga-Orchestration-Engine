/**
 * Test Suite: Multi-Tenant Distributed Workflow & Saga Engine
 * Runs deterministic tests against core engine components.
 */

import { validateWorkflowDAG } from '../server/validator.ts';
import { calculateBackoffDelay, isRetryableError } from '../server/engine/retry.ts';
import { executeSandboxedTransform } from '../server/engine/sandbox.ts';
import { hashApiKey, generateApiKey } from '../server/auth.ts';

function runTestSuite() {
  console.log('🧪 Starting Workflow & Saga Engine Automated Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // TEST 1: Cycle Detection in DAG
  console.log('[1] Cycle Detection & DAG Validation Tests:');
  const cyclicWorkflow = {
    nodes: [
      { id: 'A', type: 'START' as const, position: { x: 0, y: 0 }, data: { label: 'Node A' } },
      { id: 'B', type: 'HTTP_REQUEST' as const, position: { x: 100, y: 0 }, data: { label: 'Node B', url: 'https://api.test/b', method: 'GET' as const } },
      { id: 'C', type: 'HTTP_REQUEST' as const, position: { x: 200, y: 0 }, data: { label: 'Node C', url: 'https://api.test/c', method: 'GET' as const } },
      { id: 'D', type: 'END' as const, position: { x: 300, y: 0 }, data: { label: 'Node D' } },
    ],
    edges: [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'B', target: 'C' },
      { id: 'e3', source: 'C', target: 'A' }, // Circular dependency!
      { id: 'e4', source: 'C', target: 'D' },
    ],
  };

  const cycleResult = validateWorkflowDAG(cyclicWorkflow);
  assert(!cycleResult.valid, 'Cyclic workflow rejected as invalid');
  assert(
    cycleResult.errors.some(e => e.message.toLowerCase().includes('circular dependency')),
    'Cycle error accurately identifies circular dependency'
  );

  // TEST 2: Valid Acyclic Workflow Validation
  const validWorkflow = {
    nodes: [
      { id: 'start', type: 'START' as const, position: { x: 0, y: 0 }, data: { label: 'Start' } },
      { id: 'http', type: 'HTTP_REQUEST' as const, position: { x: 100, y: 0 }, data: { label: 'HTTP Request', url: 'https://api.test/users', method: 'GET' as const } },
      { id: 'end', type: 'END' as const, position: { x: 200, y: 0 }, data: { label: 'End' } },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'http' },
      { id: 'e2', source: 'http', target: 'end' },
    ],
  };

  const validResult = validateWorkflowDAG(validWorkflow);
  assert(validResult.valid, 'Valid acyclic DAG passes validation with zero errors');

  // TEST 3: Exponential Backoff Calculator
  console.log('\n[2] Retry & Exponential Backoff Engine Tests:');
  const policy = { maxAttempts: 4, initialDelayMs: 1000, backoffMultiplier: 2 };
  const delay1 = calculateBackoffDelay(1, policy);
  const delay2 = calculateBackoffDelay(2, policy);
  const delay3 = calculateBackoffDelay(3, policy);
  const delay4 = calculateBackoffDelay(4, policy);

  assert(delay1 === 0, 'Attempt 1 runs immediately without backoff');
  assert(delay2 >= 1000 && delay2 <= 1100, 'Attempt 2 backoff is ~1000ms (+jitter)');
  assert(delay3 >= 2000 && delay3 <= 2200, 'Attempt 3 backoff is ~2000ms (+jitter)');
  assert(delay4 >= 4000 && delay4 <= 4400, 'Attempt 4 backoff is ~4000ms (+jitter)');

  // TEST 4: Retryable Error Filter
  assert(isRetryableError({ status: 503 }, policy), 'HTTP 503 Service Unavailable recognized as retryable');
  assert(isRetryableError({ message: 'ETIMEDOUT' }, policy), 'Network timeout recognized as retryable');
  assert(!isRetryableError({ status: 400 }, policy), 'HTTP 400 Bad Request is non-retryable client error');

  // TEST 5: VM Sandboxed Code Execution
  console.log('\n[3] Sandboxed Transform Node Security Tests:');
  const safeScript = 'return { price: input.price * 1.18, processed: true };';
  const transformRes = executeSandboxedTransform(safeScript, { price: 100 });
  assert(transformRes.success, 'Sandboxed script executes successfully');
  assert(transformRes.output?.price === 118, 'Transform output calculated accurately');

  // TEST 6: Sandbox Timeout Protection
  const infiniteLoopScript = 'while(true) {}';
  const timeoutRes = executeSandboxedTransform(infiniteLoopScript, {}, 200);
  assert(!timeoutRes.success, 'Infinite loop terminated safely via execution timeout');

  // TEST 7: API Key Hashing & Security
  console.log('\n[4] Security & API Key Hashing Tests:');
  const keyObj = generateApiKey();
  assert(keyObj.rawKey.startsWith('wk_live_'), 'API key generated with standard enterprise prefix');
  const calculatedHash = hashApiKey(keyObj.rawKey);
  assert(calculatedHash === keyObj.keyHash, 'SHA-256 hash matches verification algorithm');
  assert(keyObj.rawKey !== keyObj.keyHash, 'Raw secret is never stored directly');

  console.log(`\n==============================================`);
  console.log(`Test Results: ${passed} passed, ${failed} failed.`);
  console.log(`==============================================\n`);
}

runTestSuite();
