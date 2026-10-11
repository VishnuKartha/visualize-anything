"""The oracle for this video: every number it says or shows, computed by running LRUCache.

`va facts` runs this and compares what it prints with the storyboard's "facts". It uses the real
class on the video's own example (keys A, B, C in a cache of three) and reports what happened.
"""

import ast
import json
import sys
from collections import OrderedDict
from pathlib import Path

SOURCE = Path(__file__).resolve().parent.parent / "src" / "lru_cache.py"
sys.path.insert(0, str(SOURCE.parent))

from lru_cache import LRUCache  # noqa: E402

CAPACITY = 3  # the example's cache; the storyboard records it as given


class Watched(OrderedDict):
    """An ordered dictionary that notes how full it was, and what went, each time something is evicted."""

    def __init__(self):
        super().__init__()
        self.evictions = []

    def popitem(self, last=True):
        size = len(self)
        key, value = super().popitem(last=last)
        self.evictions.append((key, size))
        return key, value


def full_cache():
    cache = LRUCache(CAPACITY)
    fields = len(vars(cache))
    cache.items = Watched()
    for key in "ABC":
        cache.put(key, key.lower())
    return cache, fields


# The opening: A went in first, is read, and then a fourth key arrives.
cache, fields = full_cache()
first_in = next(iter(cache.items))
cache.get("A")
cache.put("D", "d")
forgotten, size_at_eviction = cache.items.evictions[0]

# The write scene: refreshing a key that is already cached evicts nothing.
refresh, _ = full_cache()
refresh.get("A")
refresh.put("B", "b2")

tree = ast.parse(SOURCE.read_text())
klass = next(node for node in tree.body if isinstance(node, ast.ClassDef))
put = next(node for node in klass.body if isinstance(node, ast.FunctionDef) and node.name == "put")

print(json.dumps({
    "state-fields": fields,
    "first-in": first_in,
    "forgotten": forgotten,
    "put-decisions": sum(isinstance(node, ast.If) for node in ast.walk(put)),
    "entries-after-refresh": len(refresh.items),
    "refresh-evicts-nothing": refresh.items.evictions == [],
    "entries-before-eviction": size_at_eviction,
    "class-lines": klass.end_lineno - klass.lineno + 1,
}))
