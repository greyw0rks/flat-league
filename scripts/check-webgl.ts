import { chromium } from '@playwright/test';

for (const mode of ['headless-shell', 'chromium'] as const) {
  const browser = await chromium.launch({ headless: true, ...(mode === 'chromium' ? { channel: 'chromium' } : {}), args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage();
    console.log(mode, await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      if (!gl) return { webgl2: false };
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return { webgl2: true, renderer };
    }));
  } finally { await browser.close(); }
}
