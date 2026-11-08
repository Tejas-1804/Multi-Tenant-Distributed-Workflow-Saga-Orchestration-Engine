
import vm from 'node:vm';

export interface SandboxExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  executionTimeMs: number;
}

const DEFAULT_TIMEOUT_MS = 2000;
const MAX_TIMEOUT_MS = 10000;

/**
 * Creates a safe copy of the input before passing it to the sandbox.
 */
function cloneInput(inputData: any): any {
  if (inputData === undefined || inputData === null) {
    return {};
  }

  try {
    return JSON.parse(JSON.stringify(inputData));
  } catch {
    throw new Error('Input data could not be serialized');
  }
}

/**
 * Creates the restricted environment for transform scripts.
 */
function createSandbox(inputData: any): Record<string, any> {
  return {
    input: cloneInput(inputData),
    output: null,

    console: {
      log: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },

    Math,
    Date,
    JSON,
    Number,
    String,
    Boolean,
    Array,
    Object,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
  };
}

/**
 * Keeps the execution timeout within an acceptable range.
 */
function normalizeTimeout(timeoutMs: number): number {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.min(Math.floor(timeoutMs), MAX_TIMEOUT_MS);
}

/**
 * Prepares the transform script for execution.
 */
function buildScript(scriptStr: string): string {
  const script = scriptStr.trim();

  if (!script) {
    return 'undefined';
  }

  if (/\breturn\b/.test(script)) {
    return `
      (function () {
        'use strict';
        ${script}
      })()
    `;
  }

  return `
    (function () {
      'use strict';
      return (${script});
    })()
  `;
}

/**
 * Executes a transformation script inside a restricted VM context.
 */
export function executeSandboxedTransform(
  scriptStr: string,
  inputData: any,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): SandboxExecutionResult {
  const startTime = Date.now();

  try {
    if (typeof scriptStr !== 'string') {
      throw new Error('Transform script must be a string');
    }

    const sandbox = createSandbox(inputData);
    const context = vm.createContext(sandbox);

    // Compile the script without unsupported constructor options.
    const script = new vm.Script(buildScript(scriptStr));

    // Execute the script with a time limit.
    const result = script.runInContext(context, {
      timeout: normalizeTimeout(timeoutMs),
    });

    return {
      success: true,
      output: result !== undefined ? result : sandbox.input,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : String(error);

    return {
      success: false,
      error: errorMessage || 'Transform script evaluation failed',
      executionTimeMs: Date.now() - startTime,
    };
  }
}
