import path from 'node:path';

export function resolveInside(rootPath, relativePath = '.') {
  const root = path.resolve(rootPath);
  const target = path.resolve(root, relativePath);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path escapes the browsed project');
  }
  return target;
}

export function toProjectPath(rootPath, absolutePath) {
  return path.relative(rootPath, absolutePath).split(path.sep).join('/');
}
