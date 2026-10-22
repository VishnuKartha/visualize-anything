A recurrent network reads a sentence one word at a time. Each hidden state waits for the one before it, so within a sentence, seven words take seven steps in a row. Attention already let the decoder look back at every word, but it rode on top of that recurrence.

Throw the recurrence away and keep only attention. A model built that way, trained for twelve hours on eight GPUs, comes out ahead of every published English-to-German system, ensembles included.

<!-- The skill's own title-card line: it points back at the hook and names the paper. -->
<!-- vale ai-tells.ExplainerLeads = NO -->
That is what the paper Attention Is All You Need sets out to show.
<!-- vale ai-tells.ExplainerLeads = YES -->

So what was the recurrence costing? In this sentence, ran needs its subject, cat, five words back. In the recurrent network, cat travels through five steps of hidden state, none of them in parallel. Convolutional models like ConvS2S do run in parallel, but a distant pair needs a stack of layers to meet. Self-attention, a sentence attending to its own words, links ran to cat in one step. In the encoder, every word does this at once. The authors argue that paths this short make distant links easier to learn.

Up close, each word's vector also includes a stamp of its position, since attention by itself ignores order. From it come a query, a key and a value, three learned projections. The query of ran is dotted with every key and divided by the square root of the key size: one score per word. Softmax turns the scores into weights, and most of the weight goes to cat. The output for ran is the weighted sum of the values.

Why divide before the softmax? The model runs several attention heads side by side, each with keys of sixty-four dimensions, and random dot products of that size spread about eight times wider. The authors suspect that pushes the softmax toward all-or-nothing, where gradients are tiny. Dividing by eight brings the spread back to one.

On translation, training cost, as the authors estimate it, runs along the bottom, with English-to-German BLEU up the side. The base model, the twelve-hour one, is above and to the left of every earlier system, on the least compute. The big model clears the best by more than two points, and sets a new single-model record on English-to-French.

The price is paid in pairs. Every word scores every word, itself included. A thousand word pieces make a million scores, per head and per layer. By the paper's own count, that is cheaper per layer than recurrence only while a sentence has fewer words than its vectors have dimensions, 512 here. Training runs the decoder at once too, with later words masked, but generating output is still one word at a time.

So attention links any two words in one step, and the encoder computes every link at once. Scaling the scores, the authors suspect, keeps the softmax trainable. That design, trained for twelve hours, came out ahead of every published English-to-German system.

The paper is Attention Is All You Need, by Vaswani and colleagues.
