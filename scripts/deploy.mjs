// Direct Upload de public/ para o projeto Pages (alternativa à integração Git).
// --force impede que o Wrangler delegue o deploy a um Worker. A conta é a pessoal do autor.
import { spawnSync } from 'node:child_process';

const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID ?? 'b4bacd5445d56bfbeeef146cb2aee4d6' };
const args = ['wrangler', 'pages', 'deploy', 'public', '--project-name', 'pausa-no-prato-ihc', '--branch', 'main', '--force', '--commit-dirty=true'];
const { status } = spawnSync('npx', args, { env, stdio: 'inherit', shell: true });
process.exit(status ?? 1);
