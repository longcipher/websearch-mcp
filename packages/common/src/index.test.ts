import { describe, expect, it } from 'vitest';
import { greeting } from './index.js';

describe('greeting', () => {
  it('should build a greeting message', () => {
    expect(greeting('TypeScript')).toBe('Hello, TypeScript!');
  });

  it('should handle empty string', () => {
    expect(greeting('')).toBe('Hello, !');
  });
});
