import vm from 'node:vm';

export interface SandboxExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  executionTimeMs: number;
}

export function executeSandboxedTransform(
  scriptStr: string,
  inputData: any,
  timeoutMs: number = 2000
): SandboxExecutionResult {
  const startTime = Date.now();

  try {
    // Prepare a secure, restricted sandbox context
    const sandbox = {
      input: JSON.parse(JSON.stringify(inputData ?? {})),
      output: null,
      console: {
        log: () => {},
        warn: () => {},
        error: () => {},
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

    const context = vm.createContext(sandbox);

    // Wrap script to return result
    const wrappedScript = `
      (function() {
        'use strict';
        ${scriptStr.includes('return') ? scriptStr : `return (${scriptStr});`}
      })()
    `;

    const script = new vm.Script(wrappedScript);
    const result = script.runInContext(context, {
      timeout: timeoutMs,
      displayErrors: true,
    });

    return {
      success: true,
      output: result !== undefined ? result : sandbox.input,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Transform script evaluation failed',
      executionTimeMs: Date.now() - startTime,
    };
  }
}
