import { greeting } from 'common';
import { describe, expect, it } from 'vitest';

describe('cli-app', () => {
  it('should use greeting from common package', () => {
    expect(greeting('Bun')).toBe('Hello, Bun!');
  });

  it('should use default name', () => {
    expect(greeting('world')).toBe('Hello, world!');
  });
});
