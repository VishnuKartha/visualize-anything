<!-- The whole narration, as one piece. A paragraph is a scene; `va route` checks that the storyboard
     says these words, in this order, and nothing else. Change a line here first, reread the lines either
     side of it, then change the storyboard. -->

This cache holds three keys, and it is full. To store a fourth, it has to forget one. Which one? The obvious one to drop is whichever went in first. That is A. But A was read a moment ago. Drop it, and the next request for A misses. The key to forget is the one used longest ago, and that is B.

Keeping track of which key that is takes one small class with two pieces of state. A capacity, which is how many entries it may hold. And an ordered dictionary, which remembers the order its keys were last touched. Oldest at the front, newest at the back.

Reading a key counts as a use. Say we ask for A. A is cached, so move_to_end sends it to the newest end, and the others shift down. Then its value is returned.

Writing has two decisions in it. First, is this key already cached? B is, so it is refreshed, exactly like a read, and the new value is stored. Second decision. Did that push us over capacity? Three entries, capacity three, so nothing is evicted. But write a key the cache has never seen, and the row grows to four. Now the check fails, so popitem drops the oldest end, and we are back within our limit.

So, three things to remember. The order of use lives in a single ordered dictionary. Every read and every write moves a key to the newest end. And when the cache is over capacity, it drops the oldest end. That is how it decides what to forget.

That is LRUCache: twenty lines, in lru_cache.py.
