import fs from 'node:fs/promises';
import path from 'node:path';
import { classifyExtension, canAnalyze } from './file-types.js';
import { toProjectPath } from './path-safety.js';

const DEFAULT_IGNORES = new Set([
  '.git', '.svn', '.hg', 'node_modules', '__pycache__', '.pytest_cache',
  '.mypy_cache', '.ruff_cache', '.next', '.cache', 'coverage', 'dist', 'out',
]);

export async function scanProject(rootPath) {
  const files = [];
  const root = createDirectoryNode('', '');
  await walk(rootPath, root, files, rootPath);
  root.fileCount = countFiles(root);
  sortTree(root);
  files.sort((left, right) => left.path.localeCompare(right.path, undefined, { numeric: true }));
  return { tree: root, files };
}

async function walk(directoryPath, parentNode, files, rootPath) {
  let entries = await fs.readdir(directoryPath, { withFileTypes: true });
  entries = entries.filter((entry) => !entry.name.startsWith('.') || entry.name === '.github');

  for (const entry of entries) {
    if (DEFAULT_IGNORES.has(entry.name)) continue;
    const absolutePath = path.join(directoryPath, entry.name);
    const relativePath = toProjectPath(rootPath, absolutePath);

    if (entry.isDirectory()) {
      const node = createDirectoryNode(entry.name, relativePath);
      parentNode.children.push(node);
      await walk(absolutePath, node, files, rootPath);
      node.fileCount = countFiles(node);
      continue;
    }

    if (!entry.isFile()) continue;
    const stat = await fs.stat(absolutePath);
    const extension = path.extname(entry.name).toLowerCase();
    const file = {
      name: entry.name,
      path: relativePath,
      parent: toProjectPath(rootPath, directoryPath),
      extension,
      kind: classifyExtension(extension),
      analyzable: canAnalyze(extension),
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      modifiedKey: `${stat.size}:${stat.mtimeMs}`,
    };
    files.push(file);
    parentNode.children.push({ type: 'file', name: file.name, path: file.path, kind: file.kind });
  }
}

function createDirectoryNode(name, nodePath) {
  return { type: 'directory', name, path: nodePath, children: [], fileCount: 0 };
}

function countFiles(node) {
  return node.children.reduce((count, child) => (
    count + (child.type === 'file' ? 1 : countFiles(child))
  ), 0);
}

function sortTree(node) {
  node.children.sort((left, right) => {
    if (left.type !== right.type) return left.type === 'directory' ? -1 : 1;
    return left.name.localeCompare(right.name, undefined, { numeric: true });
  });
  for (const child of node.children) {
    if (child.type === 'directory') sortTree(child);
  }
}
