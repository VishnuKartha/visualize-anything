#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["edge-tts>=7.0"]
# ///
"""
Narration synthesis for visualize-anything (Microsoft Edge TTS, no API key).

Reads a job file listing every narration beat, synthesizes one MP3 per beat,
measures its exact duration with ffprobe, and records word-level timings. Those
durations are the time budget every visual is built against, so this runs
before any diagram, animation, or render.

    uv run tts.py --job job.json --manifest manifest.json

Per-beat audio is cached by (text, voice, rate, pitch) in the job's cache
directory, so re-runs only synthesize beats whose wording changed.
"""

import argparse
import asyncio
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

import edge_tts

TICKS_PER_SECOND = 10_000_000  # edge-tts reports offsets in 100ns units
CONCURRENCY = 4
ATTEMPTS = 3


def cache_key(text: str, voice: str, rate: str, pitch: str) -> str:
    obj = {"text": text, "voice": voice, "rate": rate, "pitch": pitch}
    return hashlib.sha256(json.dumps(obj, sort_keys=True).encode()).hexdigest()[:32]


def ffprobe_duration(path: Path) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(result.stdout.strip())


async def synthesize(text: str, voice: str, rate: str, pitch: str, mp3: Path, meta: Path) -> None:
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
            await asyncio.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"TTS failed for {text[:60]!r}: {last_error}")


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

    semaphore = asyncio.Semaphore(CONCURRENCY)
    generated = 0

    async def ensure(beat: dict) -> dict:
        nonlocal generated
        key = cache_key(beat["text"], voice, rate, pitch)
        mp3, meta = cache_dir / f"{key}.mp3", cache_dir / f"{key}.json"
        if not (mp3.exists() and meta.exists()):
            async with semaphore:
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
    print(f"TTS: {len(beats)} beat(s), {generated} synthesized, {len(beats) - generated} cached. Voice: {voice}.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as error:
        sys.exit(f"Error: {error}")
