#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["edge-tts>=7.0"]
# ///
"""
Narration synthesis for visualize-anything (Microsoft Edge TTS, no API key; or macOS `say`).

Reads a job file listing every narration beat, synthesizes one MP3 per beat,
measures its exact duration with ffprobe, and records word-level timings. Those
durations are the time budget every visual is built against, so this runs
before any diagram, animation, or render.

    uv run tts.py --job job.json --manifest manifest.json

Per-beat audio is cached by (text, voice, rate, pitch) in the job's cache
directory, so re-runs only synthesize beats whose wording changed.

Edge TTS is an online service. When it is unavailable, VA_TTS_ENGINE=franken
synthesizes on this machine instead: `franken_tts` speaks each beat, and
`franken_whisper` listens to the result to time its words. VA_TTS_VOICE names
the local voice (default "matt"); the storyboard's rate is applied as tempo.
A voice written `say:<name>` (e.g. `say:Samantha`) is spoken by macOS `say`
instead, offline. It reports no word timings, so each word is given a share of
the clip in proportion to its length: captions and word-anchored cues land
near their words rather than on them.
"""

import argparse
import asyncio
import difflib
import hashlib
import json
import os
import random
import re
import shutil
import subprocess
import sys
from pathlib import Path

import edge_tts

TICKS_PER_SECOND = 10_000_000  # edge-tts reports offsets in 100ns units
# The service answers 403 when it is asked too often; fewer at once, and a longer wait each time.
CONCURRENCY = 2
ATTEMPTS = 6
ENGINE = os.environ.get("VA_TTS_ENGINE", "edge")  # "edge": Microsoft's online voices. "franken": local.
LEAD_TRIM = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04"
LEVEL = "loudnorm=I=-19:TP=-2:LRA=11"
LOCAL_VOICES = {"matt", "james", "leo", "robert", "judy", "aria", "ember", "liam", "anthony", "russell", "steve", "daniel",
                "meryl", "laurence", "jack", "michael", "jodie", "denzel"}


def cache_key(text: str, voice: str, rate: str, pitch: str) -> str:
    obj = {"text": text, "voice": voice, "rate": rate, "pitch": pitch}
    if ENGINE != "edge":
        obj["engine"] = ENGINE  # edge keys stay as they were, so its cache survives
    return hashlib.sha256(json.dumps(obj, sort_keys=True).encode()).hexdigest()[:32]


def ffprobe_duration(path: Path) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(result.stdout.strip())


SAY_WPM = 175  # macOS `say` speaks at about this many words a minute at "+0%"


def estimated_words(text: str, duration: float) -> list:
    """Word timings for an engine that reports none: each word gets time in proportion to its length."""
    tokens = text.split()
    weights = [len(token) + 1 for token in tokens]
    total, spoken = sum(weights) or 1, max(0.0, duration - 0.15)
    words, cursor = [], 0.05
    for token, weight in zip(tokens, weights):
        span = spoken * weight / total
        words.append({"text": token.strip(".,;:!?\"'()"), "start": round(cursor, 3), "end": round(cursor + span * 0.9, 3)})
        cursor += span
    return words


def synthesize_say(text: str, voice: str, rate: str, mp3: Path, meta: Path) -> None:
    """Speak with macOS `say`, convert to MP3, and estimate word timings."""
    if not shutil.which("say"):
        raise RuntimeError('"say:" voices need macOS `say`, which is not on this machine')
    percent = float(rate.strip().rstrip("%") or 0)
    aiff = mp3.with_suffix(".aiff")
    subprocess.run(["say", "-v", voice.split(":", 1)[1], "-r", str(round(SAY_WPM * (1 + percent / 100))), "-o", str(aiff), text], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(aiff), "-ar", "24000", "-ac", "1", "-b:a", "96k", str(mp3)], check=True)
    aiff.unlink()
    duration = ffprobe_duration(mp3)
    meta.write_text(json.dumps({"duration": round(duration, 3), "words": estimated_words(text, duration), "estimated": True}))


async def synthesize(text: str, voice: str, rate: str, pitch: str, mp3: Path, meta: Path) -> None:
    if voice.startswith("say:"):
        return await asyncio.to_thread(synthesize_say, text, voice, rate, mp3, meta)
    last_error = None
    for attempt in range(ATTEMPTS):
        try:
            communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary="WordBoundary")
            words = []
            tmp = mp3.with_suffix(".part")
            with tmp.open("wb") as f:
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        f.write(chunk["data"])
                    elif chunk["type"] == "WordBoundary":
                        start = chunk["offset"] / TICKS_PER_SECOND
                        words.append({"text": chunk["text"], "start": round(start, 3),
                                      "end": round(start + chunk["duration"] / TICKS_PER_SECOND, 3)})
            if tmp.stat().st_size == 0:
                raise RuntimeError("edge-tts returned no audio")
            tmp.replace(mp3)
            meta.write_text(json.dumps({"duration": round(ffprobe_duration(mp3), 3), "words": words}))
            return
        except Exception as error:  # network hiccups are the common case; retry them
            last_error = error
            await asyncio.sleep(2 ** attempt + random.random() * 2)  # 1, 2, 4, 8, 16 seconds, plus jitter
    hint = ""
    if "403" in str(last_error):
        hint = ' The service refused every attempt. If it is down for everyone (it was from 2026-10-11, edge-tts issue #490), narrate on this machine until it is back: VA_TTS_ENGINE=franken (franken_tts, with timed words), or "voice": "say:Samantha" in the storyboard (macOS `say`, nothing to install).'
    raise RuntimeError(f"TTS failed for {text[:60]!r}: {last_error}.{hint}")


def _spoken(text: str) -> list[str]:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).split()


def listen(audio: Path) -> list[dict]:
    """The words franken_whisper hears in a clip, each with when it starts and ends."""
    result = subprocess.run(
        ["franken_whisper", "transcribe", "--input", str(audio), "--no-persist", "--json", "--language", "en",
         "--backend", "whisper-cpp", "--timestamp-level", "word"],
        capture_output=True, text=True, check=True,
    )
    heard = []
    for segment in json.loads(result.stdout)["result"]["segments"]:
        pieces = segment["text"].split()
        step = (segment["end_sec"] - segment["start_sec"]) / max(len(pieces), 1)
        for i, piece in enumerate(pieces):  # a segment is one word; split evenly if it ever is not
            heard.append({"text": piece, "start": segment["start_sec"] + i * step, "end": segment["start_sec"] + (i + 1) * step})
    return heard


def align(text: str, heard: list[dict], duration: float) -> list[dict]:
    """The written words of a beat, timed by what was heard. A recogniser mishears a name now and then,
    so words are matched in order where they agree and spaced evenly between those anchors where they do not."""
    written = text.split()
    spans = [None] * len(written)
    ours = [" ".join(_spoken(word)) for word in written]
    theirs = [" ".join(_spoken(word["text"])) for word in heard]
    for block in difflib.SequenceMatcher(None, ours, theirs, autojunk=False).get_matching_blocks():
        for k in range(block.size):
            spans[block.a + k] = (heard[block.b + k]["start"], heard[block.b + k]["end"])
    i = 0
    while i < len(written):
        if spans[i] is not None:
            i += 1
            continue
        j = i
        while j < len(written) and spans[j] is None:
            j += 1
        begin = spans[i - 1][1] if i else (heard[0]["start"] if heard else 0.0)
        finish = spans[j][0] if j < len(written) else (heard[-1]["end"] if heard else duration)
        finish = max(finish, begin)
        weights = [len(word) + 1 for word in written[i:j]]
        at = begin
        for k, weight in enumerate(weights):
            share = (finish - begin) * weight / sum(weights)
            spans[i + k] = (at, at + share)
            at += share
        i = j
    return [{"text": word, "start": round(start, 3), "end": round(min(end, duration), 3)} for word, (start, end) in zip(written, spans)]


def speak_locally(text: str, voice: str, rate: str, mp3: Path, meta: Path) -> None:
    """One beat, synthesized on this machine by franken_tts and timed by franken_whisper."""
    for tool in ("franken_tts", "franken_whisper"):
        if not shutil.which(tool):
            raise RuntimeError(f"VA_TTS_ENGINE=franken needs `{tool}` on the PATH")
    wav, part = mp3.with_suffix(".wav"), mp3.with_name(mp3.stem + ".part.mp3")
    subprocess.run(["franken_tts", "say", "-", "-o", str(wav), "--voice", voice], input=text, capture_output=True, text=True, check=True)
    change = re.fullmatch(r"([+-]\d+)%", rate or "")
    tempo = 1 + int(change.group(1)) / 100 if change else 1.0
    # franken_tts leads each clip with about a third of a second of silence and speaks some 14 dB below
    # the Edge voices. Trim the first, so beats join as they do with Edge, and level the second.
    chain = [LEAD_TRIM, *([f"atempo={tempo:.3f}"] if abs(tempo - 1) > 1e-3 else []), LEVEL]
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-filter:a", ",".join(chain), "-ar", "24000",
                    "-codec:a", "libmp3lame", "-q:a", "2", str(part)], check=True)
    wav.unlink()
    duration = ffprobe_duration(part)
    words = align(text, listen(part), duration)
    part.replace(mp3)
    meta.write_text(json.dumps({"duration": round(duration, 3), "words": words}))


async def main() -> None:
    parser = argparse.ArgumentParser(description="Synthesize narration beats with edge-tts")
    parser.add_argument("--job", required=True)
    parser.add_argument("--manifest", required=True)
    args = parser.parse_args()

    job = json.loads(Path(args.job).read_text())
    cache_dir = Path(job["cacheDir"])
    out_dir = Path(job["outDir"])
    cache_dir.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)
    voice, rate, pitch = job["voice"], job.get("rate", "+0%"), job.get("pitch", "+0Hz")
    # A `say:` voice is the storyboard's own choice, so it wins over VA_TTS_ENGINE.
    local = ENGINE == "franken" and not voice.startswith("say:")
    speaker = voice  # who is heard; the manifest keeps the storyboard's `voice`, which the timeline is checked against
    if local:
        # The storyboard names an Edge voice by default; a local run takes VA_TTS_VOICE, or a local name if the storyboard has one.
        speaker = os.environ.get("VA_TTS_VOICE") or (voice if voice in LOCAL_VOICES else "matt")
    elif ENGINE not in ("edge", "franken"):
        raise RuntimeError(f'VA_TTS_ENGINE is "{ENGINE}"; it must be "edge" or "franken"')

    semaphore = asyncio.Semaphore(1 if local else CONCURRENCY)  # one local model at a time
    generated = 0

    async def ensure(beat: dict) -> dict:
        nonlocal generated
        key = cache_key(beat["text"], speaker, rate, pitch)
        mp3, meta = cache_dir / f"{key}.mp3", cache_dir / f"{key}.json"
        if not (mp3.exists() and meta.exists()):
            async with semaphore:
                if local:
                    await asyncio.to_thread(speak_locally, beat["text"], speaker, rate, mp3, meta)
                else:
                    await synthesize(beat["text"], voice, rate, pitch, mp3, meta)
            generated += 1
        target = out_dir / beat["file"]
        shutil.copyfile(mp3, target)
        return {**beat, **json.loads(meta.read_text()), "key": key}

    beats = await asyncio.gather(*(ensure(beat) for beat in job["beats"]))

    wanted = {beat["file"] for beat in job["beats"]}
    for stale in out_dir.glob("*.mp3"):
        if stale.name not in wanted:
            stale.unlink()

    Path(args.manifest).write_text(json.dumps({"voice": voice, "rate": rate, "pitch": pitch, "beats": beats}, indent=2))
    print(f"TTS: {len(beats)} beat(s), {generated} synthesized, {len(beats) - generated} cached. Voice: {speaker}.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as error:
        sys.exit(f"Error: {error}")
