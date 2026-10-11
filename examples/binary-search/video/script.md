<!-- The whole narration, as one piece. A paragraph is a scene; `va route` checks that the storyboard
     says these words, in this order, and nothing else. Change a line here first, reread the lines either
     side of it, then change the storyboard. -->

A sorted list of a million items can be searched in twenty looks. Here is how, on a list of seven. The obvious way is to check every item in turn. Finding 57 takes six looks. Binary search checks the middle, throws half the list away, and gets there in two.

Here is how it knows which half to throw away. Two markers, lo and hi, start at the two ends of the sorted list. Each time around the loop, look at the middle item. 23 is less than 57, so everything from the middle down is ruled out, and lo jumps past it. Second pass. The middle is now 57, which is the target, so we return its index.

Two passes for seven items, because every pass throws away half of what is left. So how many for a million? A list of n items needs about log base two of n passes. For a million items, that is twenty.

Three things to remember. The list has to be sorted first. Each pass halves the range. And that is why a million items take only about twenty passes.

That is binary_search: eleven lines of Python.
