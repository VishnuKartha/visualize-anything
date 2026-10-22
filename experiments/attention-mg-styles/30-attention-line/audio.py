# ATTENTION — "One line, all at once". Score + sound design, locked to cues.json.
# The idea in sound: the recurrence is seven piano notes, one per step, each waiting for the last; self-attention is the
# same seven notes struck together as one chord when every arc appears. Felt piano + strings + air (E major), a celesta on
# the link landing on "cat", a breath, then the fill resolves on Emaj9 with a chime. Pen whisper under every stroke.
import sys, json, os
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'lib', 'audio'))
import mgaudio as mg
from mgaudio import sfx, synth, fm, samples, filters, pluck

HERE = os.path.dirname(os.path.abspath(__file__))
C = json.load(open(os.path.join(HERE, 'cues.json')))
STEPS, LINK, BLOOM, FILL = C['steps'], C['link'], C['bloom'], C['fill']
WM, TAG, RULES, GLINT = C['wordmark'], C['tagline'], C['rules'], C['glint']

NOTES = [64, 66, 68, 71, 73, 76, 78]          # E4 F#4 G#4 B4 C#5 E5 F#5: one per word
m = mg.Mix(duration=10.0, bpm=72)
m.group('music').level = -20

piano = samples.inst('piano')
pn = m.track('piano', level=-19, sends={'hall': -9}, hp=70, lp=6000)
def P(t, note, vel=0.4, dur=2.2):
    pn.add(piano.play(note, dur=dur, vel=vel, release=0.8), t)

# the recurrence: one note per closed loop, even and patient
for t, n in zip(STEPS, NOTES):
    P(t - 0.01, n, 0.36, 1.4)
    m.sfx(sfx.click('soft'), at=t - 0.006, gain=-22, pan=float(np.interp(t, [STEPS[0], STEPS[-1]], [-0.5, 0.5])))
P(0.0, 40, 0.32, 2.4)                                          # a low E under frame 0

# the link: strings rise with the arc, celesta on the landing at "cat"
st = m.track('strings', level=-23, sends={'hall': -6}, hp=150)
CH = [(0.0, BLOOM[0], [52, 59, 64, 68]), (BLOOM[0], FILL[0], [49, 56, 61, 64, 68]), (FILL[0], 10.0, [40, 52, 59, 63, 66, 71])]
for a, b, v in CH:
    st.add(synth.pad(v, (b - a) + 0.6, 0.7, 'strings', attack=0.45, release=0.8, seed=int(a * 10)), a)
st.automate('gain', [(0, -18), (LINK[0], -12), (LINK[1], -4), (BLOOM[0] - 0.02, -4), (BLOOM[0] + 0.01, -8), (BLOOM[0] + 0.16, -4), (BLOOM[1], -2), (FILL[0] - 0.35, -14), (FILL[0], 0), (9.0, -4), (10, -14)])
st.automate('lpf', [(0, 1500), (LINK[1], 4000), (FILL[0], 9000), (10, 5000)])
air = m.track('air', level=-28, sends={'hall': -4})
for a, b, v in CH:
    air.add(synth.pad(v, (b - a) + 0.8, 0.6, 'air', attack=0.6, release=0.9, seed=7 + int(a)), max(0.0, a - 0.05))
m.sfx(sfx.whoosh(1.3, 'soft', direction=-1, peak=0.55, seed=3), at=LINK[0] + 0.7, gain=-14, pan=0.1)
m.sfx(fm.bell('B5', 1.6, 0.5, 'celesta').loud(-18), at=LINK[1] + 0.04, gain=-12, pan=-0.35, verb=-8)

# all at once: the same seven notes, together
for n in NOTES:
    P(BLOOM[0] - 0.008, n, 0.6, 2.6)
P(BLOOM[0] - 0.008, 40, 0.6, 2.6)
m.sfx(sfx.impact('soft', size=0.6, seed=21), at=BLOOM[0] - 0.006, gain=-8, verb=-10)
hp_ = m.track('harp', level=-22, sends={'hall': -5})
for n in NOTES:
    hp_.add(pluck.harp(n + 12, 1.6, 0.32), BLOOM[0])
m.sfx(sfx.sparkle(1.1, density=22, key='E', mode='major_pentatonic', seed=6), at=BLOOM[0] + 0.2, gain=-14, verb=-8)

# the breath, then the fill
m.group('music').automate('gain', [(0, 0), (FILL[0] - 0.45, 0), (FILL[0] - 0.22, -10), (FILL[0] - 0.02, -10), (FILL[0], 0), (9.2, 0), (9.7, -6), (10, -20)])
m.sfx(sfx.reverse_cymbal(1.0, seed=2), at=FILL[0], gain=-17)
m.sfx(sfx.impact('soft', size=1.0, seed=4), at=FILL[0] - 0.008, gain=-1, verb=-8)
for n, v in [(28, 0.5), (40, 0.48), (59, 0.36), (63, 0.34), (68, 0.36), (83, 0.34)]:
    P(FILL[0] - 0.01, n, v, 2.8)
m.sfx(sfx.chime(('E6', 'G#6', 'B6', 'D#7'), step=0.05, kind='celesta'), at=FILL[0], gain=-4, verb=-8)
m.track('sub', level=-26).add(synth.bass('E1', 2.2, 0.7, 'sub'), FILL[0])
m.sfx(sfx.sparkle(0.9, density=12, key='E', mode='major_pentatonic', seed=9), at=GLINT[0] + 0.2, gain=-15, verb=-8)

# the sign-off
m.sfx(fm.bell('D#6', 1.6, 0.42, 'celesta').loud(-18), at=WM + 0.12, gain=-11, pan=0.15, verb=-8)
P(TAG + 0.05, 80, 0.22, 1.6)
P(RULES[1] - 0.02, 83, 0.2, 1.2)

# pen whisper: a stroke for each move between loops and one long stroke for the link
strokes = [(0.0, STEPS[0])] + [(STEPS[i] + 0.04, STEPS[i + 1] - STEPS[i] - 0.06) for i in range(6)] + [(STEPS[6] + 0.04, 0.12)]
m.sfx(sfx.pen('pen', 2.5, strokes=strokes, seed=11), at=0.0, gain=-12)
m.sfx(sfx.pen('pen', LINK[1] - LINK[0] + 0.1, strokes=[(0.0, LINK[1] - LINK[0])], seed=12), at=LINK[0], gain=-14, pan=-0.1)

m.master_kw.update(air=2.0)
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
res = m.export(os.path.join(HERE, 'out/audio.wav'), lufs=-14, tp=-1, spectrogram=os.path.join(HERE, 'out/audio_spec.png'))
print({k: res[k] for k in ('duration', 'lufs', 'true_peak', 'stereo_corr', 'longest_gap') if k in res})
print('warnings', res.get('warnings'))
print('align', mg.hit_alignment(os.path.join(HERE, 'out/audio.wav'), [STEPS[0], STEPS[3], LINK[1], BLOOM[0], FILL[0], WM + 0.12]))
