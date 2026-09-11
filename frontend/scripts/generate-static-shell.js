/**
 * Generates a static index.html shell for Render Free Static Site deployment.
 * Renders the root page using the compiled TanStack Start / Nitro server entry.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverEntryPath = path.resolve(__dirname, '../.output/server/index.mjs');
const publicDir = path.resolve(__dirname, '../.output/public');
const targetIndexPath = path.join(publicDir, 'index.html');

async function generateStaticShell() {
  if (!fs.existsSync(serverEntryPath)) {
    console.error(`[StaticShell] Error: Server entry not found at ${serverEntryPath}`);
    process.exit(1);
  }

  const serverModule = await import(`file://${serverEntryPath}`);
  const handler = serverModule.default;

  const mockEnv = {};
  const mockCtx = { waitUntil: () => {} };
  const request = new Request('http://localhost/');

  console.log('[StaticShell] Rendering static HTML shell from compiled server entry...');
  const response = await handler.fetch(request, mockEnv, mockCtx);

  if (response.status !== 200) {
    console.error(`[StaticShell] Failed to render HTML shell (HTTP status: ${response.status})`);
    process.exit(1);
  }

  const html = await response.text();
  fs.writeFileSync(targetIndexPath, html, 'utf-8');
  console.log(`[StaticShell] Successfully created ${targetIndexPath} (${html.length} bytes)`);
}

generateStaticShell().catch((err) => {
  console.error('[StaticShell] Error generating static shell:', err);
  process.exit(1);
});
