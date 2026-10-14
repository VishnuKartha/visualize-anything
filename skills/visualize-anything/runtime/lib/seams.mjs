// Seams: the places a video stops being one continuous thing. Every finding here is measured on
// the rendered file (frames compared, silences timed, levels read), so the same video always
// gets the same answer. What the numbers mean is decided once, below.

export const SEAM = {
  cut: 0.02, // share of the picture that may change in one frame...
  spike: 2, // ...when that is at least this many times the change in the frames either side. A fade changes several frames alike; a cut changes one.
  alike: 0.99, // how alike the frames either side of a carried-on join must be (structural similarity, 0 to 1)
  carryPause: 1.0, // seconds the voice may stop at a join where the picture carries on
  deadAir: 3.0, // seconds the voice may stop anywhere
  level: 4, // dB one line may sit above or below the rest
  firstPicture: 2.0, // seconds the video may run before anything is on screen
};

const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const sceneAt = (props, seconds) => {
  const frame = Math.round(seconds * props.fps);
  return props.scenes.find((scene) => frame >= scene.from && frame < scene.from + scene.frames) || props.scenes.at(-1);
};
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : NaN;
};

/**
 * Turn measurements into findings.
 * measured: {changes: [{time, score}] (one per frame), joins: [{index, similarity}], silences: [{start, end}],
 *            levels: [{scene, beat, mean}], firstPicture: seconds | null}
 */
export const findSeams = (props, measured) => {
  const seams = [];
  const total = props.totalFrames / props.fps;
  const starts = props.scenes.map((scene) => scene.from / props.fps);

  if (measured.firstPicture === null || measured.firstPicture > SEAM.firstPicture) {
    seams.push({
      kind: 'empty',
      at: 0,
      text: `Nothing is on screen for the first ${measured.firstPicture === null ? 'several' : measured.firstPicture.toFixed(1)} seconds. Put the opening picture up as the voice starts.`,
    });
  }

  // One finding per moment: a swap often shows up in two neighbouring frames.
  const moments = [];
  const changes = measured.changes || [];
  // A spike is measured against the frames that exist on either side: the video's first and last frames have one neighbour,
  // and a missing one is not a still frame (a fade-out that ends with the video would otherwise read as a cut).
  const neighbours = (index) => [changes[index - 1], changes[index + 1]].filter(Boolean).map((change) => change.score);
  const cuts = changes.filter((change, index) => change.score >= SEAM.cut && neighbours(index).length > 0 && change.score >= SEAM.spike * Math.max(...neighbours(index)));
  for (const cut of cuts) {
    const last = moments.at(-1);
    if (last && cut.time - last.time < 0.2) last.score = Math.max(last.score, cut.score);
    else moments.push({...cut});
  }
  for (const cut of moments) {
    const index = starts.findIndex((start) => Math.abs(start - cut.time) <= 2.5 / props.fps);
    if (index > 0) {
      const [before, after] = [props.scenes[index - 1], props.scenes[index]];
      seams.push({
        kind: 'cut',
        at: cut.time,
        text: `${clock(cut.time)}: the picture changes in a single frame at the join from "${before.id}" into "${after.id}". ${
          after.fadeIn === false
            ? 'The join is marked as carrying on, so whatever differs between the two scenes is swapped in one frame: start the second scene on the frame the first ended on.'
            : 'Let the first scene end, and the second begin, on a fade.'
        }`,
      });
    } else {
      seams.push({
        kind: 'cut',
        at: cut.time,
        text: `${clock(cut.time)}: the picture changes in a single frame inside "${sceneAt(props, cut.time).id}". Something large appears, vanishes, or jumps without an animation: fade or move it instead.`,
      });
    }
  }

  for (const join of measured.joins || []) {
    if (join.similarity >= SEAM.alike) continue;
    const [before, after] = [props.scenes[join.index - 1], props.scenes[join.index]];
    seams.push({
      kind: 'jump',
      at: starts[join.index],
      text: `${clock(starts[join.index])}: "${after.id}" is marked as continuing "${before.id}", but its first frame is not the frame that scene ended on (alike ${join.similarity.toFixed(3)}, needs ${SEAM.alike}). Build both pictures with the same helpers and open the second with self.appear(...), or drop "continues".`,
    });
  }

  for (const silence of measured.silences || []) {
    const length = silence.end - silence.start;
    if (silence.start < 0.05 || silence.end > total - 0.05) continue; // before the first word and after the last
    const index = starts.findIndex((start, i) => i > 0 && start > silence.start && start < silence.end);
    if (index > 0 && props.scenes[index].fadeIn === false && length > SEAM.carryPause) {
      seams.push({
        kind: 'pause',
        at: silence.start,
        text: `${clock(silence.start)}: the picture carries on from "${props.scenes[index - 1].id}" into "${props.scenes[index].id}", but the voice stops for ${length.toFixed(1)}s. Remove the "pause" or "hold" at that join so it sounds like one scene.`,
      });
    } else if (length >= SEAM.deadAir) {
      seams.push({kind: 'air', at: silence.start, text: `${clock(silence.start)}: ${length.toFixed(1)}s with no voice. Shorten the "pause" or "hold" there.`});
    }
  }

  const levels = (measured.levels || []).filter((entry) => Number.isFinite(entry.mean));
  const usual = median(levels.map((entry) => entry.mean));
  for (const entry of levels) {
    const off = entry.mean - usual;
    if (Math.abs(off) <= SEAM.level) continue;
    const scene = props.scenes.find((candidate) => candidate.id === entry.scene);
    seams.push({
      kind: 'level',
      at: scene ? scene.from / props.fps : 0,
      text: `"${entry.scene}" beat ${entry.beat} is ${Math.abs(off).toFixed(1)} dB ${off > 0 ? 'louder' : 'quieter'} than the rest of the narration. Reword the line or run \`va tts\` again.`,
    });
  }

  return seams.sort((a, b) => a.at - b.at);
};
