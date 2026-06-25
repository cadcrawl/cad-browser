import test from 'node:test';
import assert from 'node:assert/strict';
import { hasChildDirectories } from '../src/tree-utils.js';

test('only folders with child folders are expandable', () => {
  assert.equal(hasChildDirectories({
    children: [{ type: 'file', name: 'part.step' }],
  }), false);
  assert.equal(hasChildDirectories({
    children: [{ type: 'directory', name: 'drawings', children: [] }],
  }), true);
});
