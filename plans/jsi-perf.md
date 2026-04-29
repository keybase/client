# JSI Performance Evaluation Plan

## Summary

Keybase is on RN 0.83.4 with New Architecture and Hermes enabled. RN's public TurboModule Codegen surface still does not document ArrayBuffer or typed-array parameters, but RN's C++ JSI API exposes MutableBuffer, ArrayBuffer, direct buffer data access, NativeState, and runtime data. The evaluation should focus on our pure C++ JSI bridge in react-native-kb, not on moving the RPC pipe to normal TurboModule methods.

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

## Sources

- React Native New Architecture docs: https://reactnative.dev/architecture/landing-page
- RN 0.83 Native Modules docs: https://reactnative.dev/docs/0.83/turbo-native-modules-introduction
- RN Codegen typings appendix: https://reactnative.dev/docs/appendix
- RN 0.83.4 JSI header: https://raw.githubusercontent.com/facebook/react-native/v0.83.4/packages/react-native/ReactCommon/jsi/jsi/jsi.h
- RN 0.83 release notes: https://reactnative.dev/blog/2025/12/10/react-native-0.83
- Margelo JSI performance post: https://blog.margelo.com/make-jsi-run-faster
