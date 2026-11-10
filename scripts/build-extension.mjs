import { build as buildVite } from 'vite';
import { build as buildScripts } from 'esbuild';

await buildVite({ configFile: 'vite.extension.config.ts' });
await buildScripts({
  entryPoints: { background: 'extension/background.ts', reader: 'extension/content/reader.ts' },
  outdir: 'dist-extension',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'chrome116',
  sourcemap: false,
  logLevel: 'info',
});
console.log('Chrome extension ready in dist-extension/');
