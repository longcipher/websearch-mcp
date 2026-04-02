import { parseArgs } from 'node:util';
import { greeting } from 'common';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    name: {
      type: 'string',
      short: 'n',
      default: 'world',
    },
  },
  strict: true,
});

// biome-ignore lint/suspicious/noConsole: CLI apps require console output
console.log(greeting(values.name ?? 'world'));
