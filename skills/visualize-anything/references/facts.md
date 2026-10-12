# Facts

A number that you type into the narration can be wrong, and nothing detects it. The voice says "six looks". The animation counts six because the script told it to. The real function takes five. Thus, do not type a number in a video. Each number is a row in the `facts` of the storyboard. A script runs the real code and calculates each row again.

This is step 2 of the workflow, before the storyboard has scenes. Calculate the numbers first. Then you write the script from numbers that are true.

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
| `id` | A kebab-case name. The oracle prints it. A Manim script reads it. |
| `value` | A number, `true` or `false`, or a string (`"B"`, `"O(log n)"`). |
| `what` | A description of the value, as a phrase that a reviewer can compare with the narration. |
| `given` | Use it when nothing can calculate the number. It gives the source of the number: the size that you selected for the example, the count of takeaways. Use it rarely. A `given` is a number that nobody examined. In a paper project, the tool does one check: the number must be in the paper that `va paper` read ([paper.md](paper.md)). |

## The oracle

The oracle is `facts.py` (or `facts.mjs`) in the project directory. It imports the code that the video explains. It runs the code on the example of the video. It prints one JSON object as its last line: fact id to value.

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

- **It runs the real code.** Watch the function to count its work: use a list that records its reads, or a dictionary that records its evictions. Do not implement the function again.
- **It does not repeat a number.** `"scan-looks": 6` typed into the oracle examines nothing. `VALUES.index(57) + 1` does.
- **It uses the example of the video.** Use the same list, the same keys, and the same capacity as the pictures.

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

A row that is different or missing fails the command, and `va build` does not start. When a fact is different, the code is correct. Change the narration and the picture. If the oracle is incorrect, change the oracle. Do not change the `value` to agree with a sentence that you like.

A calculated value agrees at the precision of the storyboard: `20` agrees with 19.93, and `96.5` agrees with 96.49. The said number and the shown number round the same way, because they are the same row.

## Every number said or shown

`va route` reads each `say`, each on-screen `text`, the recap items, the thumbnail, and the hook. It lists each number that is not a row of the ledger. It reads digits (`57`, `1,000,000`, `96.5%`) and words (`twenty`, `a million`). It ignores "one" alone, ordinals, and numbers in identifiers (`log2`).

The check is on values, not on meanings. "Two markers" passes because a fact has the value 2. The expert reviewer gets the ledger and makes sure that each number means what its row says.

## In a Manim script

A script reads a fact. It does not type it:

```python
looks = Text(str(fact("scan-looks")), font_size=40, color=AMBER)
```

`fact("<id>")` gives the value in the storyboard. Thus the number on screen is the number that `va facts` examined. A change to a fact renders again the scenes that read it. A counter that counts is better. Drive it from the same list that the animation walks, and let the oracle confirm where it ends.

## Always and never

A sentence with `always`, `never`, `at most`, `at least`, `guaranteed`, `every time`, or `no matter` is a claim about all cases. That includes the cases that the video does not show: nothing in it, one thing in it, a tie, the limit. `va route` flags each such sentence until the beat names the fact that tested it:

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

`holds` must name a fact whose value is `true`. If the oracle finds the limit where the claim breaks, change the sentence. "Never" becomes "not, as long as the cache holds more than one key", or the limit gets its own beat (story.md, "Name the limit").

## Where this came from

Three ideas come from [jeffs_math_explainer_videos](https://github.com/Dicklesworthstone/jeffs_math_explainer_videos) by Jeffrey Emanuel: the ledger, the independent oracle, and the test of each "always" and "never" at its limits before the voice says it. In that project, the scene calculates each number of a maths video, and a separate script holds it. We took the idea and no code.
