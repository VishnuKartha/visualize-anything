"""The oracle for this video: every number it says or shows, computed by running binary_search.

`va facts` runs this and compares what it prints with the storyboard's "facts". It imports the real
function and watches what it does; nothing here restates a number from the narration.
"""

import ast
import json
import sys
from pathlib import Path

SOURCE = Path(__file__).resolve().parent.parent / "src" / "binary_search.py"
sys.path.insert(0, str(SOURCE.parent))

from binary_search import binary_search  # noqa: E402

VALUES = [3, 8, 15, 23, 42, 57, 61]  # the list the video searches
TARGET = 57


class Watched(list):
    """A list that remembers which positions were looked at, in order."""

    def __init__(self, values):
        super().__init__(values)
        self.seen = []

    def __getitem__(self, index):
        if not self.seen or self.seen[-1] != index:
            self.seen.append(index)
        return super().__getitem__(index)


def passes(values, target):
    watched = Watched(values)
    binary_search(watched, target)
    return watched


def scan_looks(values, target):
    for looks, value in enumerate(values, start=1):
        if value == target:
            return looks
    return len(values)


small = passes(VALUES, TARGET)
million = range(1_000_000)
# The most passes any search of a million items can take: a target past either end, and one in between.
worst = max(len(passes(million, target).seen) for target in (-1, 1_000_000, 499_999.5, 0, 999_999))
function = next(node for node in ast.parse(SOURCE.read_text()).body if isinstance(node, ast.FunctionDef))

print(json.dumps({
    "items": len(VALUES),
    "target": TARGET,
    "scan-looks": scan_looks(VALUES, TARGET),
    "binary-looks": len(small.seen),
    "first-middle": VALUES[small.seen[0]],
    "passes-for-a-million": worst,
    "lines": function.end_lineno - function.lineno + 1,
}))
