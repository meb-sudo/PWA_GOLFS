#!/usr/bin/env node
/**
 * Lance le BFF et la PWA en parallele.
 *
 * npm execute ses scripts via cmd.exe sous Windows, ou "A & B" enchaine au
 * lieu de paralleliser : le BFF bloquerait et la PWA ne demarrerait jamais.
 * On spawn donc les deux processus explicitement.
 */
import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const services = [
  { name: 'bff', workspace: '@golf/bff', color: '[36m' },
  { name: 'web', workspace: '@golf/web', color: '[32m' },
];

const RESET = '[0m';
const children = [];

for (const service of services) {
  const child = spawn(npm, ['run', 'dev', '--workspace', service.workspace], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });

  const prefix = `${service.color}[${service.name}]${RESET} `;
  const relay = (stream) => {
    stream.setEncoding('utf8');
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) process.stdout.write(prefix + line + '\n');
    });
  };
  relay(child.stdout);
  relay(child.stderr);

  child.on('exit', (code) => {
    process.stdout.write(`${prefix}arrete (code ${code})\n`);
    stopAll();
    process.exit(code ?? 0);
  });

  children.push(child);
}

function stopAll() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { stopAll(); process.exit(0); });
}
