import { execFileSync } from 'node:child_process';

const allHistory = process.argv.includes('--history');
const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
const sensitiveFile =
  /(^|\/)(\.env(?:\..*)?|id_rsa|id_ed25519|credentials(?:\.json)?|.*\.(?:pem|p12|pfx))$/i;
const patterns = [
  /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/,
  /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*["'][A-Za-z0-9_./+=-]{20,}["']/i,
  /\/(?:Users|home)\/[A-Za-z0-9_.-]+\//,
];

const refs = allHistory ? git('rev-list', '--all').trim().split('\n').filter(Boolean) : [':'];
const failures = new Set();
let checked = 0;
for (const ref of refs) {
  const files = (ref === ':' ? git('ls-files', '-z') : git('ls-tree', '-rz', '--name-only', ref))
    .split('\0')
    .filter(Boolean);
  for (const file of files) {
    if (sensitiveFile.test(file) && !file.endsWith('.env.example')) {
      failures.add(file);
      continue;
    }
    if (/\.(?:png|jpg|jpeg|gif|webp|woff2?|ico)$/i.test(file)) continue;
    const text = git('show', ref === ':' ? `:${file}` : `${ref}:${file}`);
    checked++;
    if (patterns.some((pattern) => pattern.test(text))) failures.add(file);
  }
}

if (failures.size) {
  console.error(
    'Commit blocked: review these files for credentials or personal machine paths. Values are not printed.',
  );
  for (const file of failures) console.error(`- ${file}`);
  process.exit(1);
}
console.log(
  `Credential check passed for ${checked} file snapshots${allHistory ? ' across Git history' : ' in the Git index'}.`,
);
