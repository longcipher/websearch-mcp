/**
 * Common utilities and shared code.
 *
 * This package contains shared utilities, types, and functions
 * used across multiple packages in the workspace.
 */

/**
 * Builds a greeting string.
 *
 * @param name - The name to greet.
 * @returns A greeting message.
 */
export function greeting(name: string): string {
  return `Hello, ${name}!`;
}

export * from './checkout.js';
