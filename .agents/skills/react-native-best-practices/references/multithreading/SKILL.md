---
name: multithreading
description: "Software Mansion's best practices for multithreading in React Native apps using react-native-worklets. Use when running JavaScript on multiple threads, offloading heavy computation from the JS thread, communicating between runtimes, or sharing data across threads. Trigger on: 'worklet', 'worklets', 'react-native-worklets', 'runOnUI', 'runOnJS', 'scheduleOnUI', 'scheduleOnRN', 'scheduleOnRuntime', 'createWorkletRuntime', 'background thread', 'UI thread', 'worker runtime', 'Serializable', 'Synchronizable', 'multithreading', 'parallel execution', 'offload computation', 'background processing', 'Bundle Mode', or any request to move work off the JS thread in a React Native app."
---

# React Native Multithreading with Worklets

Software Mansion's production multithreading patterns for React Native using `react-native-worklets`.

React Native Worklets lets you run JavaScript code in parallel across multiple threads and runtimes. It powers Reanimated, Gesture Handler, and Skia under the hood.

## Version Check

Before answering any multithreading question, check that `react-native-worklets` is up to date:

1. Read the user's `package.json` to find the installed `react-native-worklets` version.
2. Run `npm view react-native-worklets version` to get the latest published version.
3. If the installed version is older than the latest, inform the user and recommend upgrading before proceeding with implementation advice.

## Runtime Model

React Native apps have three kinds of runtimes. Picking the right target is the first decision:

```
What does the work need?
├── Respond to native events or drive animations on the same frame?
│   └── UI Runtime (main thread, one per app)
├── Heavy computation, data processing, or background tasks?
│   └── Worker Runtime (custom thread, many per app)
└── Access React state, navigation, or RN APIs?
    └── RN Runtime (JS thread, one per app)
```

Runtimes do not share memory. Data crosses runtime boundaries through serialization (immutable copies) or Synchronizable (shared mutable state).

## API Decision Tree

```
Need to run code on a different runtime?
├── Fire-and-forget (no return value needed)?
│   ├── Target is UI Runtime  → scheduleOnUI(fn, ...args)
│   ├── Target is RN Runtime  → scheduleOnRN(fn, ...args)
│   └── Target is Worker      → scheduleOnRuntime(runtime, fn, ...args)
├── Need the return value asynchronously (Promise)?
│   ├── Target is UI Runtime  → await runOnUIAsync(fn, ...args)
│   └── Target is Worker      → await runOnRuntimeAsync(runtime, fn, ...args)
└── Need the return value synchronously (blocks caller)?
    ├── Target is UI Runtime  → runOnUISync(fn, ...args)
    └── Target is Worker      → runOnRuntimeSync(runtime, fn, ...args)
```

## Critical Rules

**The `'worklet'` directive**: functions that run on Worklet Runtimes must be workletized. Add `'worklet';` as the first statement in the function body. Callbacks passed to `scheduleOnUI`, `scheduleOnRuntime`, and similar APIs are autoworkletized by the Babel plugin.

```tsx
function computeOnUI() {
  'worklet';
  return 2 + 2;
}
```

**Don't call scheduling APIs from the wrong runtime**: `scheduleOnUI`, `runOnUISync`, `runOnUIAsync`, `runOnRuntimeSync`, `runOnRuntimeAsync`, `scheduleOnRuntime` can only be called from the RN Runtime (unless Bundle Mode is enabled). Calling them from a Worklet Runtime throws an error.

**Closures are copied, not shared**: when a worklet runs on a different runtime, its closure variables are serialized at invocation time. Mutating the original variable after scheduling has no effect on the worklet's copy.

**Deprecated APIs**: `runOnUI` is replaced by `scheduleOnUI`. `runOnJS` is replaced by `scheduleOnRN`. `runOnRuntime` is replaced by `scheduleOnRuntime`. The new APIs pass arguments directly instead of returning a curried function.

## References

Load at most one reference file per question.

| File | Load when question is about |
|------|------------------------------|
| `threading-api.md` | Scheduling work across runtimes, creating Worker Runtimes, sync vs async execution, migrating from deprecated APIs |
| `shared-memory.md` | Passing data between runtimes, closures in worklets, Serializable, Synchronizable, shared mutable state |
| `setup-and-advanced.md` | Installing worklets, Babel plugin config, Bundle Mode, testing with Jest, feature flags, troubleshooting |
