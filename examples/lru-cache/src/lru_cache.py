from collections import OrderedDict


class LRUCache:
    """A fixed-size cache that forgets whatever was used longest ago."""

    def __init__(self, capacity: int):
        self.capacity = capacity
        self.items = OrderedDict()  # oldest first, newest last

    def get(self, key):
        if key not in self.items:
            return None
        self.items.move_to_end(key)  # a read counts as a use
        return self.items[key]

    def put(self, key, value):
        if key in self.items:
            self.items.move_to_end(key)
        self.items[key] = value
        if len(self.items) > self.capacity:
            self.items.popitem(last=False)  # evict the least recently used
