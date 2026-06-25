import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scanProject } from '../src/scanner.js';

test('scans folders, classifies engineering files, and ignores node_modules', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cad-browser-scan-'));
  try {
    await fs.mkdir(path.join(root, 'drawings'));
    await fs.mkdir(path.join(root, 'node_modules'));
    await fs.writeFile(path.join(root, 'part.step'), 'step');
    await fs.writeFile(path.join(root, 'drawings', 'drawing.pdf'), 'pdf');
    await fs.writeFile(path.join(root, 'README.md'), '# Project');
    await fs.writeFile(path.join(root, 'notes.txt'), 'engineering notes');
    await fs.writeFile(path.join(root, 'node_modules', 'ignored.stl'), 'stl');

    const result = await scanProject(root);

    assert.equal(result.files.length, 4);
    assert.equal(result.tree.fileCount, 4);
    assert.deepEqual(result.files.map((file) => file.kind).sort(), ['cad', 'pdf', 'text', 'text']);
    assert.equal(result.files.every((file) => file.analyzable), true);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
