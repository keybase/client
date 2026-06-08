# Threading API

All imports come from `react-native-worklets`.

---

## Scheduling (Fire-and-Forget)

Use scheduling functions when you need to run code on another runtime and don't need a return value.

### scheduleOnUI

Schedules a worklet to run asynchronously on the UI Runtime. The callback is autoworkletized.

```tsx
import { scheduleOnUI } from 'react-native-worklets';

function onPress() {
  scheduleOnUI((greeting: string) => {
    console.log(`${greeting} from the UI Runtime`);
  }, 'Hello');
}
```

- Can only be called from the RN Runtime (unless Bundle Mode is enabled).
- On the Web, schedules work via `requestAnimationFrame`.

### scheduleOnRN

Schedules a function to run on the RN Runtime from any Worklet Runtime. The primary way to update React state from the UI thread.

```tsx
import { scheduleOnRN } from 'react-native-worklets';

// Inside a worklet (e.g., gesture callback running on UI thread)
scheduleOnRN(setCount, newCount);
```

- The function passed to `scheduleOnRN` must be defined in the RN Runtime scope (component body or module scope). Defining a function inside a worklet and passing it to `scheduleOnRN` will fail.

```tsx
// WRONG: function defined inside a worklet
scheduleOnUI(() => {
  const myFn = () => { /* ... */ };
  scheduleOnRN(myFn); // throws
});

// CORRECT: function defined in RN Runtime scope
const myFn = () => { /* ... */ };
scheduleOnUI(() => {
  scheduleOnRN(myFn);
});
```

### scheduleOnRuntime

Schedules a worklet on a Worker Runtime. The callback is autoworkletized.

```tsx
import { scheduleOnRuntime, createWorkletRuntime } from 'react-native-worklets';

const backgroundRuntime = createWorkletRuntime({ name: 'background' });

scheduleOnRuntime(backgroundRuntime, (data: number[]) => {
  const sum = data.reduce((a, b) => a + b, 0);
  console.log('Sum:', sum);
}, [1, 2, 3, 4, 5]);
```

- Can only be called from the RN Runtime (unless Bundle Mode is enabled).
- `scheduleOnRuntimeWithId` is a variant that accepts a `runtimeId` number instead of a runtime object. Useful when you don't have a reference to the runtime object but know its ID.

---

## Async Execution (Returns a Promise)

Use when you need the return value from another runtime and can await it.

### runOnUIAsync

Runs a worklet on the UI Runtime and returns a Promise of the result.

```tsx
import { runOnUIAsync } from 'react-native-worklets';

const result = await runOnUIAsync(() => {
  'worklet';
  return someUIThreadComputation();
});
```

- Can only be called from the RN Runtime.
- The Promise resolves asynchronously after the callback executes.

### runOnRuntimeAsync

Runs a worklet on a Worker Runtime and returns a Promise of the result. Best choice for offloading heavy computation.

```tsx
import { runOnRuntimeAsync, createWorkletRuntime } from 'react-native-worklets';

const backgroundRuntime = createWorkletRuntime({ name: 'background' });

async function processData(data: number[]) {
  const result = await runOnRuntimeAsync(backgroundRuntime, (numbers: number[]) => {
    'worklet';
    return numbers.reduce((sum, n) => sum + n, 0);
  }, data);

  console.log('Result:', result);
}
```

- Can only be called from the RN Runtime.
- Errors thrown in the worklet cause the Promise to reject.
- Not available on Web.

---

## Sync Execution (Blocks the Caller)

Use when you need the return value immediately and can tolerate blocking the calling thread.

### runOnUISync

Runs a worklet synchronously on the UI Runtime. Blocks the RN Runtime until the worklet finishes.

```tsx
import { runOnUISync } from 'react-native-worklets';

const result = runOnUISync((x: number) => {
  'worklet';
  return x + 1;
}, 41);

console.log(result); // 42
```

- Can only be called from the RN Runtime.
- Return values must be convertible to a Serializable.

### runOnRuntimeSync

Runs a worklet synchronously on a Worker Runtime. Blocks the caller and can preempt the runtime's current thread.

```tsx
import { runOnRuntimeSync, createWorkletRuntime } from 'react-native-worklets';

const worker = createWorkletRuntime({ name: 'worker' });

const result = runOnRuntimeSync(worker, () => {
  'worklet';
  return 2 + 2;
});
```

- Can only be called from the RN Runtime (unless Bundle Mode is enabled).
- `runOnRuntimeSyncWithId` is a variant that accepts a `runtimeId`.

---

## Creating Worker Runtimes

Worker Runtimes run worklets on separate threads for background processing.

```tsx
import { createWorkletRuntime } from 'react-native-worklets';

const runtime = createWorkletRuntime({
  name: 'data-processor',      // Debug label
  initializer: () => {         // Runs synchronously after creation
    'worklet';
    console.log('Runtime ready');
  },
  enableEventLoop: true,       // Provides setTimeout, setInterval, etc.
});
```

### Configuration options

| Option | Default | Purpose |
|--------|---------|---------|
| `name` | `'anonymous'` | Debug label for the runtime |
| `initializer` | none | Worklet to inject globals or setup code |
| `enableEventLoop` | `true` | Provides `setTimeout`, `setInterval`, `requestAnimationFrame`, `queueMicrotask` |
| `animationQueuePollingRate` | `16` | Milliseconds between frame callback polls |
| `useDefaultQueue` | `true` | Use the built-in scheduling queue |
| `customQueue` | none | Custom queue object (requires `useDefaultQueue: false`) |

### What's available on Worker Runtimes

Out of the box, Worker Runtimes have `performance.now`, `console.*`, and (when `enableEventLoop` is true) timer APIs. Other APIs (networking, storage, etc.) are unavailable unless injected via the `initializer` worklet or captured via closure. Bundle Mode lifts this restriction by giving worklets access to the full JavaScript bundle.

---

## Targeting Runtimes by ID

Every runtime has a unique numeric `runtimeId`. The `UIRuntimeId` constant provides the UI Runtime's ID. Use ID-based variants when you have the ID but no reference to the runtime object:

```tsx
import { UIRuntimeId, scheduleOnRuntimeWithId } from 'react-native-worklets';

// Target UI Runtime by ID
scheduleOnRuntimeWithId(UIRuntimeId, () => {
  console.log('Running on UI Runtime');
});

// Target a Worker Runtime by ID
scheduleOnRuntimeWithId(myRuntime.runtimeId, () => {
  console.log('Running on worker');
});
```

---

## Runtime Detection

Utility functions to check which runtime is executing the current code:

```tsx
import {
  isRNRuntime, isUIRuntime, isWorkerRuntime, isWorkletRuntime,
  getRuntimeKind, RuntimeKind,
} from 'react-native-worklets';

// Boolean checks
isRNRuntime();       // true on JS thread
isUIRuntime();       // true on UI thread
isWorkerRuntime();   // true on any Worker Runtime
isWorkletRuntime();  // true on UI or Worker Runtime

// Enum-based
getRuntimeKind();    // RuntimeKind.ReactNative (1), UI (2), or Worker (3)
```

Useful for writing functions that behave differently depending on which runtime calls them.

---

## Migrating from Deprecated APIs

| Deprecated | Replacement | Key difference |
|-----------|-------------|----------------|
| `runOnUI(fn)(args)` | `scheduleOnUI(fn, args)` | Arguments passed directly, no currying |
| `runOnJS(fn)(args)` | `scheduleOnRN(fn, args)` | Arguments passed directly, no currying |
| `runOnRuntime(rt, fn)(args)` | `scheduleOnRuntime(rt, fn, args)` | Arguments passed directly, no currying |
| `executeOnUIRuntimeSync(fn)(args)` | `runOnUISync(fn, args)` | Arguments passed directly, no currying |

### Common Mistakes

```tsx
// WRONG: calling the function inside the API
runOnUIAsync(myWorklet(10));       // passes the return value, not the worklet
scheduleOnUI(myWorklet(10));       // same mistake

// CORRECT: pass function reference and arguments separately
await runOnUIAsync(myWorklet, 10);
scheduleOnUI(myWorklet, 10);
```
