import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../src/args.js';

test('uses the current folder and port 6767 by default', () => {
  assert.deepEqual(parseArgs([]), {
    port: 6767,
    open: true,
    host: '127.0.0.1',
    directory: '.',
  });
});

test('parses a folder and server options', () => {
  assert.deepEqual(parseArgs(['C:\\project', '--port', '7000', '--no-open']), {
    port: 7000,
    open: false,
    host: '127.0.0.1',
    directory: 'C:\\project',
  });
});

test('rejects invalid ports', () => {
  assert.throws(() => parseArgs(['--port', '0']), /Port must be/);
});
