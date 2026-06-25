export function hasChildDirectories(node) {
  return Array.isArray(node?.children) && node.children.some((child) => child.type === 'directory');
}
