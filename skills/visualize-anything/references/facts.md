# Facts

A number typed into narration can be wrong, and nothing will notice: the voice says "six looks", the animation counts six because the script was told to, and the real function takes five. So no number in a video is typed. Each one is a row in the storyboard's `facts`, and each row is computed again by a script that runs the real code.

This is step 2 of the workflow, before the storyboard has scenes. Work out the numbers first; the script is then written from numbers that are known to be true.

## The ledger

```json
"facts": [
  {"id": "scan-looks", "value": 6, "what": "looks a scan from the front takes to reach the target"},
  {"id": "binary-looks", "value": 2, "what": "passes binary_search takes to reach the target"},
  {"id": "passes-for-a-million", "value": 20, "what": "the most passes binary_search can take on a million items"},
  {"id": "a-million", "value": 1000000, "given": "the size of list the hook asks about"},
  {"id": "takeaways", "value": 3, "given": "the recap has three items"}
]
```

| Field | Meaning |
|---|---|
| `id` | Kebab-case name. The oracle prints it; a Manim script reads it. |
| `value` | A number, `true` or `false`, or a string (`"B"`, `"O(log n)"`). |
| `what` | What the value is, in a phrase a reviewer can check against the narration. |
| `given` | Instead of being computed: where the number comes from when nothing can compute it. The size the example was chosen to be, the count of takeaways. Use it sparingly; a `given` is a number nobody checked. |

## The oracle

`facts.py` (or `facts.mjs`) in the project directory. It imports the code the video is about, runs it on the video's own example, and prints one JSON object as its last line: fact id to value.

```python
import json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from binary_search import binary_search

VALUES = [3, 8, 15, 23, 42, 57, 61]

class Watched(list):
    """A list that remembers which positions were looked at."""
    def __init__(self, values):
        super().__init__(values)
        self.seen = []
    def __getitem__(self, index):
        if not self.seen or self.seen[-1] != index:
            self.seen.append(index)
        return super().__getitem__(index)

watched = Watched(VALUES)
binary_search(watched, 57)
print(json.dumps({"binary-looks": len(watched.seen), "first-middle": VALUES[watched.seen[0]]}))
```

Three rules make it an oracle and not a second copy of the narration:

- **It runs the real code.** Count what the function does by watching it (a list that records its reads, a dictionary that records its evictions), not by reimplementing it.
- **It restates nothing.** `"scan-looks": 6` typed into the oracle checks nothing. `VALUES.index(57) + 1` does.
- **It uses the video's example.** The same list, the same keys, the same capacity the pictures use.

```bash
VA facts <project>
```

```
facts: 9 in the storyboard, checked against facts.py.
   ok      scan-looks                    6  looks a scan from the front takes to reach the target
  DIFFERS  binary-looks                  3  the oracle computed 2
  MISSING  lines                        11  facts.py does not print "lines"
   given   takeaways                     3  the recap has three items
```

A row that differs or is missing fails the command, and `va build` will not start. When a fact differs, the code is right: change the narration and the picture, or the oracle if it is the one that is wrong. Never change the `value` to match a sentence you like.

A computed value matches at the precision the storyboard writes: `20` matches 19.93, `96.5` matches 96.49. What is said and what is shown round the same way because they are the same row.

## Every number said or shown

`va route` reads every `say`, every on-screen `text`, the recap items, the thumbnail, and the hook, and lists each number that is no row of the ledger: digits (`57`, `1,000,000`, `96.5%`) and words (`twenty`, `a million`). "One" on its own is skipped, and so are ordinals and numbers inside identifiers (`log2`).

The check is on values, not meanings: "two markers" passes because some fact has the value 2. Whether each number means what its row says is for the expert reviewer, who is handed the ledger.

## In a Manim script

A script reads a fact instead of typing it:

```python
looks = Text(str(fact("scan-looks")), font_size=40, color=AMBER)
```

`fact("<id>")` returns the storyboard's value, so the number on screen is the one `va facts` checked. Changing a fact rerenders the scenes that read one. Better still is a counter that counts: drive it from the same list the animation walks, and let the oracle confirm where it ends.

## Always and never

A sentence that says `always`, `never`, `at most`, `at least`, `guaranteed`, `every time`, or `no matter` is a claim about every case, including the ones the video does not show: nothing in it, one thing in it, a tie, the limit. `va route` flags each one until the beat names the fact that tested it:

```json
{"say": "A key that was read a moment ago is never the next one evicted.", "holds": "recent-key-survives"}
```

```python
def recent_key_survives(capacity):
    cache = LRUCache(capacity)
    for key in range(capacity):
        cache.put(key, key)
    cache.get(0)
    cache.put("new", 1)
    return cache.get(0) is not None

# Capacity 1 is the edge: the key just read is the only one there is.
print(json.dumps({"recent-key-survives": all(recent_key_survives(n) for n in range(1, 6))}))
```

`holds` must name a fact whose value is `true`. If the oracle finds the edge where the claim breaks, the sentence changes: "never" becomes "not, as long as the cache holds more than one key", or the limit gets its own beat (story.md, "Name the limit").

## Where this came from

The ledger, the independent oracle, and testing every always and never at its edges before it is voiced come from Jeffrey Emanuel's [jeffs_math_explainer_videos](https://github.com/Dicklesworthstone/jeffs_math_explainer_videos), where every number in a maths video is computed by the scene and pinned against a separate script. The idea is taken; no code is.
