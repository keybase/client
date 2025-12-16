# Immer Bug Reproducer

Minimal reproducer for an immer bug that occurs when calling `toggleLocalReaction` in a zustand store with immer middleware.

## Setup

```bash
npm install
```

## Run Tests

```bash
npm test
```

## Description

This reproducer captures the minimal logic from `toggleLocalReaction` that demonstrates a bug with immer when:

1. Getting a value from a Map (`messageMap.get(targetOrdinal)`)
2. Getting or creating a nested value from another Map (`m.reactions?.get(emoji)`)
3. Mutating a Set that's nested inside the Map value (`rs.users.delete()` and `rs.users.add()`)
4. Conditionally deleting from the Map based on Set size (`m.reactions.delete(emoji)`)

The bug manifests when toggling a reaction multiple times - the reaction may not be properly removed or added back due to immer's draft state handling.

