# ATTENTION — one story, fifteen styles: the soundtrack for one style. python3 audio.py <slug>
# The music is that style's own recipe (mgaudio.recipes.STYLES), with its drop on the bloom and its outro on the title.
# The story's sound is the same in every style, voiced with the style's palette: one sound per word on the seven steps,
# a landing on the link, a hit on the bloom ("all at once"), a bigger one on the hero, a sparkle on the title.
import sys, os, json
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'lib', 'audio'))
import mgaudio as mg
from mgaudio import recipes, sfx, fm, drums, chip, samples

SLUG = sys.argv[1]
C = json.load(open(os.path.join(HERE, 'cues.json')))
STEPS, LINK, BLOOM, HERO, TITLE = C['steps'], C['link'], C['bloom'], C['fill'], C['wordmark']

# per style: (step sound, link sound, bloom hit, hero hit, title accent), each a function of i or nothing
pitch = lambda i: 1 + 0.06 * i
STYLE = {
    '01-flat-vector': (lambda i: sfx.pop('bubble', pitch=pitch(i)), lambda: sfx.transition(0.6, 'swish_pop'), lambda: sfx.impact('punch'), lambda: sfx.whoosh(0.8, 'swoosh'), lambda: sfx.ui('confirm')),
    '03-isometric': (lambda i: sfx.blip(72 + 2 * i, 'tri'), lambda: sfx.whoosh(0.7, 'swish'), lambda: sfx.ui('open'), lambda: sfx.impact('soft'), lambda: sfx.ui('confirm')),
    '04-3d-render': (lambda i: sfx.bubble(size=0.5), lambda: sfx.gloop(pitch=1.0, dur=0.5), lambda: sfx.impact('soft'), lambda: sfx.boing(pitch=1.0), lambda: sfx.pop('cork')),
    '05-cel-boil': (lambda i: sfx.pen('pencil', 0.18), lambda: sfx.whoosh(0.6, 'cloth'), lambda: sfx.paper('flip', 0.4), lambda: sfx.swish(0.3), lambda: sfx.pop('mouth')),
    '06-collage': (lambda i: sfx.sticker_slap(), lambda: sfx.tape_rip(0.4), lambda: sfx.scissors(), lambda: sfx.stamp('rubber'), lambda: sfx.shutter('film')),
    '07-liquid': (lambda i: sfx.drip(pitch=pitch(i)), lambda: sfx.squelch(0.5), lambda: sfx.splash(size=0.6), lambda: sfx.splash(size=1.0), lambda: sfx.bubbles(0.6)),
    '08-morph': (lambda i: sfx.blip(76 + 2 * i, 'sine'), lambda: sfx.morph(0.6, up=True), lambda: sfx.stretch(0.5, up=True), lambda: sfx.morph(0.8, up=False), lambda: sfx.pop('soft')),
    '09-bauhaus': (lambda i: sfx.click('hard'), lambda: sfx.whoosh(0.6, 'swish'), lambda: sfx.impact('punch'), lambda: sfx.impact('punch', size=1.2), lambda: sfx.tick('wood')),
    '10-synthwave': (lambda i: sfx.laser('zap'), lambda: sfx.whoosh(0.8, 'sci'), lambda: sfx.shimmer_hit(72), lambda: sfx.impact('cinematic'), lambda: sfx.shimmer_hit(84)),
    '12-aurora-glass': (lambda i: fm.bell(84 + [0, 2, 4, 7, 9, 12, 14][i], 1.0, 0.4, 'glock').loud(-20), lambda: sfx.whoosh(0.8, 'air'), lambda: sfx.magic(0.8, key='E'), lambda: sfx.shimmer_hit(76), lambda: sfx.sparkle(0.6)),
    '18-hanazi': (lambda i: sfx.pop('mouth', pitch=pitch(i)), lambda: sfx.slide_whistle(up=True, dur=0.6), lambda: sfx.duang(pitch=1.0), lambda: sfx.boing(pitch=0.8), lambda: sfx.rimshot_joke()),
    '19-paperclip': (lambda i: sfx.tick('clock'), lambda: sfx.whoosh(0.6, 'swish'), lambda: sfx.ui('open'), lambda: sfx.paper('slide', 0.5), lambda: sfx.ui('confirm')),
    '20-pixel': (lambda i: sfx.coin(), lambda: sfx.jump(), lambda: sfx.powerup(), lambda: sfx.oneup(), lambda: sfx.coin()),
    '22-hud': (lambda i: sfx.hud_beep(84), lambda: sfx.lock_on(0.8), lambda: sfx.hud_scan(0.6), lambda: sfx.hud_alert(), lambda: sfx.hud_ping(88)),
}
step, link, bloom, hero, title = STYLE[SLUG]

m = recipes.for_style(SLUG, drop=BLOOM[0], outro=TITLE)
for i, t in enumerate(STEPS):
    m.sfx(step(i), at=t - 0.01, gain=-6, pan=float(np.interp(i, [0, 6], [-0.5, 0.5])))
m.sfx(link(), at=LINK[1], gain=-3)
m.sfx(bloom(), at=BLOOM[0], gain=-1)
m.sfx(hero(), at=HERO[0], gain=0)
m.sfx(title(), at=TITLE, gain=-4)

os.makedirs(os.path.join(HERE, 'out', 'audio'), exist_ok=True)
res = m.export(os.path.join(HERE, 'out', 'audio', f'{SLUG}.wav'), lufs=-14, tp=-1)
print(SLUG, {k: res[k] for k in ('duration', 'lufs', 'true_peak') if k in res}, res.get('warnings'))
