import path from 'node:path';
import { spawn } from 'node:child_process';
import open from 'open';

export function revealCommand(filePath, platform = process.platform, windowsDirectory = process.env.SystemRoot ?? process.env.WINDIR ?? 'C:\\Windows') {
  if (platform === 'win32') {
    return {
      command: path.win32.join(windowsDirectory, 'explorer.exe'),
      args: [`/select,${filePath}`],
    };
  }
  if (platform === 'darwin') {
    return { command: 'open', args: ['-R', filePath] };
  }
  return { command: 'xdg-open', args: [path.dirname(filePath)] };
}

export async function revealFile(filePath, platform = process.platform) {
  const { command, args } = revealCommand(filePath, platform);
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

export async function openFile(filePath) {
  await open(filePath, { wait: false });
}
