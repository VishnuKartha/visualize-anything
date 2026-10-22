// Remotion through its Node API rather than its CLI: one bundle and one browser serve every
// scene and every contact sheet of a run, and the page can report measurements back.
import {rmSync} from 'node:fs';
import path from 'node:path';
import {RUNTIME_DIR, fail, findChrome} from './util.mjs';

const PROBE_TIMEOUT = 9000; // a healthy browser loads the composition in well under a second

/** Bundle the composition once, hand a renderer to `work`, and clean up afterwards. */
export const withRenderer = async (publicDir, work) => {
  const {bundle} = await import('@remotion/bundler');
  const {openBrowser, renderMedia, renderStill, selectComposition} = await import('@remotion/renderer');
  const serveUrl = await bundle({entryPoint: path.join(RUNTIME_DIR, 'src', 'index.ts'), publicDir});

  // Remotion's own headless browser is the default. It draws on the system's display clock, so
  // with the display asleep or the session locked it never produces a frame and every render
  // would time out. Full Chrome's headless mode keeps its own clock, so fall back to it.
  // VA_CHROME names a browser on purpose: use it, and never download Remotion's own (which fails offline, or
  // behind a proxy that refuses remotion.media, as an error nothing here can catch).
  let mode = process.env.VA_CHROME ? {browserExecutable: process.env.VA_CHROME, chromeMode: 'chrome-for-testing'} : {};
  let browser = await openBrowser('chrome', {logLevel: 'error', ...mode});
  const common = () => ({serveUrl, puppeteerInstance: browser, logLevel: 'error', ...mode});
  try {
    await selectComposition({...common(), id: 'Explainer', inputProps: {}, timeoutInMilliseconds: PROBE_TIMEOUT});
  } catch (error) {
    await browser.close({silent: true}).catch(() => undefined);
    const chrome = findChrome();
    if (!/delayRender|timeout/i.test(String(error?.message)) || !chrome) {
      rmSync(serveUrl, {recursive: true, force: true});
      fail(
        `Remotion's browser could not load the composition${chrome ? '' : ', and Google Chrome is not installed to fall back to (or set VA_CHROME)'}.\n` +
          String(error?.message).split('\n')[0],
      );
    }
    console.log("  note: Remotion's headless browser is not producing frames (usually the display is asleep or locked); rendering with Google Chrome instead.");
    mode = {browserExecutable: chrome, chromeMode: 'chrome-for-testing'};
    browser = await openBrowser('chrome', {logLevel: 'error', ...mode});
  }

  const compose = (id, inputProps) => selectComposition({...common(), id, inputProps});
  try {
    return await work({
      /** One image. `onLog` receives every console line the page prints while rendering it. */
      still: async ({id, inputProps, output, frame = 0, onLog}) => {
        const composition = await compose(id, inputProps);
        // Remotion echoes page logs to the terminal as well as handing them over; keep ours out of it.
        const write = process.stdout.write.bind(process.stdout);
        if (onLog) process.stdout.write = (chunk, ...rest) => (String(chunk).includes('VA_') ? true : write(chunk, ...rest));
        try {
          return await renderStill({...common(), composition, output, frame, inputProps, overwrite: true, onBrowserLog: (entry) => onLog?.(entry.text)});
        } finally {
          process.stdout.write = write;
        }
      },
      /** A silent H.264 file covering an inclusive frame range of the composition. */
      video: async ({id, inputProps, output, frameRange, draft = false}) =>
        renderMedia({
          ...common(),
          composition: await compose(id, inputProps),
          codec: 'h264',
          outputLocation: output,
          inputProps,
          frameRange,
          muted: true,
          scale: draft ? 0.5 : 1,
          crf: draft ? 30 : 18,
          overwrite: true,
        }),
    });
  } finally {
    await browser.close({silent: true}).catch(() => undefined);
    rmSync(serveUrl, {recursive: true, force: true});
  }
};
