# JSI Performance Evaluation Plan

## Summary

Keybase is on RN 0.83.4 with New Architecture and Hermes enabled. RN's public TurboModule Codegen surface still does not document ArrayBuffer or typed-array parameters, but RN's C++ JSI API exposes MutableBuffer, ArrayBuffer, direct buffer data access, NativeState, and runtime data. The evaluation should focus on our pure C++ JSI bridge in react-native-kb, not on moving the RPC pipe to normal TurboModule methods.

## Progress

- [x] Added build-time experiment switches so baseline and prototype bridge implementations can be built separately.
- [x] Added an optional outbound Uint8Array fast path controlled by `KB_JSI_OUTBOUND_TYPED_ARRAY_FASTPATH`.
- [x] Added benchmark-only measurement hooks controlled by `KB_JSI_PERF`.
- [x] Added inbound binary prototypes controlled by `KB_JSI_INBOUND_BINARY_MODE`.
- [ ] Run the benchmark-only workflow on a machine with installed JS/native toolchains.

## Evaluation Targets

- Benchmark current bridge costs in react-native-kb: rpcOnGo, rpcOnJs, msgpack encode/decode, object/map walking, string conversion, binary payload handling, JNI/ObjC copies, and batching.
- Prototype, in benchmark-only code, creating inbound binary values via jsi::MutableBuffer + Runtime::createArrayBuffer instead of constructing Uint8Array(size) and copying into its buffer.
- Test whether JS can safely accept ArrayBuffer directly for msgpack binary fields; if not, measure new Uint8Array(arrayBuffer) wrapping versus the current constructor path.
- Evaluate typed-array detection in convertJSIToMP: avoid getPropertyNames() before checking ArrayBuffer/typed-array-like objects when payloads contain binary data.
- Evaluate NativeState only for JS-visible stateful native objects; current hot RPC function does not need it, and the existing teardown HostObject is not a hot path.
- Evaluate runtime/engine compatibility explicitly against Hermes current, Hermes V1, and JSC fallback assumptions before adopting any ArrayBuffer-backed fast path.

## API Policy

- Preserve the existing JS contract: global.rpcOnGo(message) and global.rpcOnJs(objs, count).
- Do not migrate this RPC pipe to normal TurboModule methods unless benchmarks show a clear win; Codegen's documented type surface is currently weaker for arbitrary msgpack/binary payloads.
- Any binary representation change must be behavior-compatible with existing RPC consumers, especially code expecting Uint8Array rather than ArrayBuffer.

## Test Plan

- Add native round-trip tests or a standalone benchmark harness for nulls, booleans, integers, floats, strings, maps, arrays, empty objects, ArrayBuffer, Uint8Array, and large binary blobs.
- Measure before/after on representative RPC shapes: small method calls, nested maps, chat/message payloads, and binary-heavy payloads.
- Use RN 0.83 Web Performance APIs / DevTools Performance panel for JS-side timing where useful.
- Do not run yarn, npm, yarn lint, or yarn tsc on this machine because node_modules is absent.

## Run / Evaluation Notes

- Keep all measurements benchmark-only until the current bridge baseline is captured and compared against any ArrayBuffer-backed prototype.
- This machine cannot run the JS validation or benchmark workflow because `node_modules` is absent; do not run `yarn`, `npm`, `yarn lint`, `yarn tsc`, or other node-based tooling here.
- Local work on this machine is limited to code/document inspection and source updates. Run the benchmark harness, RN build, and validation on a machine with dependencies installed.
- The remaining unchecked item is the actual run/result capture step on a runnable environment.

## Experiment Matrix

Default build behavior is the baseline:

- `KB_JSI_INBOUND_BINARY_MODE=0`: current inbound BIN behavior, `Uint8Array(size)` plus copy into its buffer.
- `KB_JSI_OUTBOUND_TYPED_ARRAY_FASTPATH=0`: current outbound typed-array detection order, using `getPropertyNames()` before the broad shape probe.
- `KB_JSI_PERF=0`: no benchmark globals or counters.

Prototype builds:

- `KB_JSI_INBOUND_BINARY_MODE=1`: inbound BIN becomes a direct `ArrayBuffer` backed by `jsi::MutableBuffer`. This is expected to change JS-visible behavior and must not ship without consumer validation.
- `KB_JSI_INBOUND_BINARY_MODE=2`: inbound BIN uses `jsi::MutableBuffer` + `createArrayBuffer`, then wraps with `new Uint8Array(arrayBuffer)` to preserve the expected JS `Uint8Array` shape.
- `KB_JSI_OUTBOUND_TYPED_ARRAY_FASTPATH=1`: outbound encode checks `instanceof Uint8Array` before property enumeration and keeps the old broad shape probe as fallback.
- `KB_JSI_PERF=1`: installs `global.kbJSIExperimentConfig` and `global.kbJSIPerf`.

Android build knobs are CMake/Gradle properties:

- `Kb_JSI_INBOUND_BINARY_MODE=0|1|2`
- `Kb_JSI_OUTBOUND_TYPED_ARRAY_FASTPATH=OFF|ON`
- `Kb_JSI_PERF=OFF|ON`

iOS build knobs are environment variables consumed by the podspec:

- `KB_JSI_INBOUND_BINARY_MODE=0|1|2`
- `KB_JSI_OUTBOUND_TYPED_ARRAY_FASTPATH=0|1`
- `KB_JSI_PERF=0|1`

Benchmark globals when `KB_JSI_PERF=1`:

- `global.kbJSIExperimentConfig`: confirms which experiment was compiled into the app.
- `global.kbJSIPerf.stats()`: returns counters for `rpcOnGo`, encode, frame copy, native write, inbound unpack, JSI conversion, and `rpcOnJs` call time.
- `global.kbJSIPerf.reset()`: clears counters.
- `global.kbJSIPerf.makeBinary(size, mode)`: returns benchmark binary values for `uint8Array`, `arrayBuffer`, or `wrappedUint8Array`.
- `global.kbJSIPerf.roundTrip(value, iterations, mode)`: msgpack-encodes and decodes a value in native code; decode mode is `uint8Array`, `arrayBuffer`, or `wrappedUint8Array`.

Validation shape:

- Build baseline with `KB_JSI_PERF=1`, all other experiment knobs at defaults, and capture `kbJSIPerf.stats()` during normal app RPC traffic.
- Build each prototype separately and compare behavior with the same RPC flows.
- For binary behavior, compare `roundTrip` results with values covering nulls, booleans, integers, floats, strings, maps, arrays, empty objects, `ArrayBuffer`, `Uint8Array`, sliced `Uint8Array`, and large binary blobs.

Example JS console checks in a `KB_JSI_PERF=1` build:

- `global.kbJSIExperimentConfig`
- `const bin = global.kbJSIPerf.makeBinary(1024, 'uint8Array')`
- `global.kbJSIPerf.roundTrip({bin, nested: [bin]}, 1000, 'uint8Array').value.bin instanceof Uint8Array`
- `global.kbJSIPerf.roundTrip({bin}, 1000, 'arrayBuffer').value.bin instanceof ArrayBuffer`
- `global.kbJSIPerf.roundTrip({bin}, 1000, 'wrappedUint8Array').value.bin instanceof Uint8Array`
- `global.kbJSIPerf.stats()`

## Sources

- React Native New Architecture docs: https://reactnative.dev/architecture/landing-page
- RN 0.83 Native Modules docs: https://reactnative.dev/docs/0.83/turbo-native-modules-introduction
- RN Codegen typings appendix: https://reactnative.dev/docs/appendix
- RN 0.83.4 JSI header: https://raw.githubusercontent.com/facebook/react-native/v0.83.4/packages/react-native/ReactCommon/jsi/jsi/jsi.h
- RN 0.83 release notes: https://reactnative.dev/blog/2025/12/10/react-native-0.83
- Margelo JSI performance post: https://blog.margelo.com/make-jsi-run-faster
