import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/700.css';
import {continueRender, delayRender} from 'remotion';

// Fonts are bundled, so renders work offline and text metrics match on every machine.
const FACES = [
  '400 16px Inter', '500 16px Inter', '600 16px Inter', '700 16px Inter', '800 16px Inter',
  "400 16px 'JetBrains Mono'", "500 16px 'JetBrains Mono'", "600 16px 'JetBrains Mono'", "700 16px 'JetBrains Mono'",
];

if (typeof document !== 'undefined') {
  const handle = delayRender('Loading bundled fonts');
  Promise.all(FACES.map((face) => document.fonts.load(face)))
    .catch(() => undefined)
    .then(() => continueRender(handle));
}
