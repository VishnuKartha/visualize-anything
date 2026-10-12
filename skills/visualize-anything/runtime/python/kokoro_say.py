#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10,<3.14"
# dependencies = ["kokoro-onnx>=0.4", "soundfile>=0.12"]
# ///
"""
Speak one line with Kokoro, an open text-to-speech model that runs on this machine.

    uv run kokoro_say.py --voice am_michael --speed 1.1 --out clip.wav < line.txt

tts.py calls this when VA_TTS_ENGINE=kokoro. The model and its voices (about 340 MB together) live
under ~/.visualize-anything/vendor/kokoro, are fetched once from the kokoro-onnx release if they are
not there, and are checked against the hashes below either way.
"""

import argparse
import hashlib
import os
import sys
import urllib.request
from pathlib import Path

RELEASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
FILES = {
    "kokoro-v1.0.onnx": "7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5",
    "voices-v1.0.bin": "bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d",
}
HOME = Path(os.environ.get("VISUALIZE_ANYTHING_HOME") or Path.home() / ".visualize-anything")
MODEL_DIR = Path(os.environ.get("VA_KOKORO_DIR") or HOME / "vendor" / "kokoro")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def model_files() -> list[Path]:
    """The model and the voices, fetched if they are missing. A file with the wrong hash is refused."""
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    paths = []
    for name, expected in FILES.items():
        path, checked = MODEL_DIR / name, MODEL_DIR / f"{name}.sha256-ok"
        if not path.exists():
            print(f"Fetching {name} for Kokoro (once)...", file=sys.stderr, flush=True)
            part = path.with_suffix(path.suffix + ".part")
            urllib.request.urlretrieve(f"{RELEASE}/{name}", part)
            part.replace(path)
            checked.unlink(missing_ok=True)
        # Hashing 300 MB takes a second or two: do it once per file, not once per line.
        if not checked.exists():
            if sha256(path) != expected:
                raise SystemExit(f"Error: {path} is not the Kokoro file this skill was checked against. Delete it and run again.")
            checked.write_text(expected)
        paths.append(path)
    return paths


def main() -> None:
    parser = argparse.ArgumentParser(description="Speak text from stdin with Kokoro")
    parser.add_argument("--voice", default="am_michael")
    parser.add_argument("--speed", type=float, default=1.0)
    parser.add_argument("--out", required=True)
    parser.add_argument("--voices", action="store_true", help="list the voices and exit")
    args = parser.parse_args()

    model, voices = model_files()
    from kokoro_onnx import Kokoro
    import soundfile

    kokoro = Kokoro(str(model), str(voices))
    if args.voices:
        print("\n".join(sorted(kokoro.get_voices())))
        return
    text = sys.stdin.read().strip()
    if not text:
        raise SystemExit("Error: no text on stdin")
    if args.voice not in kokoro.get_voices():
        raise SystemExit(f'Error: Kokoro has no voice "{args.voice}". Run with --voices to list them.')
    # British voices (bf_, bm_) read with British pronunciation; the others with American.
    samples, rate = kokoro.create(text, voice=args.voice, speed=args.speed, lang="en-gb" if args.voice[:1] == "b" else "en-us")
    soundfile.write(args.out, samples, rate)


if __name__ == "__main__":
    main()
