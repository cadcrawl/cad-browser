import test from 'node:test';
import assert from 'node:assert/strict';
import { revealCommand } from '../src/reveal-file.js';

test('builds a Windows Explorer selection command without a shell', () => {
  assert.deepEqual(revealCommand('C:\\project\\part.step', 'win32', 'C:\\Windows'), {
    command: 'C:\\Windows\\explorer.exe',
    args: ['/select,C:\\project\\part.step'],
  });
});

test('builds platform-specific reveal commands', () => {
  assert.deepEqual(revealCommand('/project/part.step', 'darwin'), {
    command: 'open',
    args: ['-R', '/project/part.step'],
  });
  assert.deepEqual(revealCommand('/project/part.step', 'linux'), {
    command: 'xdg-open',
    args: ['/project'],
  });
});
