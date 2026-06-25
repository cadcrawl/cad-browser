import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveInside } from '../src/path-safety.js';

test('resolves a project-relative file', () => {
  assert.equal(resolveInside('C:\\project', 'drawings\\part.pdf'), path.resolve('C:\\project', 'drawings\\part.pdf'));
});

test('rejects paths outside the project', () => {
  assert.throws(() => resolveInside('C:\\project', '..\\secret.txt'), /escapes/);
});
