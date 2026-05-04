#include "react-native-kb.h"
#include <chrono>
#include <cmath>
#include <cstring>
#include <limits>
#include "msgpack-safe.hpp"
#include <string>

using namespace facebook;
using namespace facebook::jsi;

namespace kb {

struct KBBridge::MsgpackState {
  msgpack::unpacker unpacker;
  msgpack::sbuffer sendBuf;
};

class KBMutableBuffer final : public MutableBuffer {
public:
  explicit KBMutableBuffer(size_t size) : bytes_(size) {}
  size_t size() const override { return bytes_.size(); }
  uint8_t *data() override { return bytes_.data(); }

private:
  std::vector<uint8_t> bytes_;
};

#if KB_JSI_PERF
using KBPerfClock = std::chrono::steady_clock;

static uint64_t perfNanosSince(KBPerfClock::time_point start) {
  return static_cast<uint64_t>(
      std::chrono::duration_cast<std::chrono::nanoseconds>(
          KBPerfClock::now() - start)
          .count());
}

static void fillPerfBytes(uint8_t *data, size_t size) {
  for (size_t i = 0; i < size; ++i) {
    data[i] = static_cast<uint8_t>(i & 0xff);
  }
}
#endif

KBBridge::KBBridge() = default;
KBBridge::~KBBridge() = default;

void KBBridge::teardown() {
  isTornDown_.store(true);
  // Clear cached JSI objects while the runtime is still alive.
  // This prevents stale jsi::Function destructors from crashing
  // if the bridge outlives the runtime (due to shared_ptr captures).
  cachedUint8ArrayCtor_.reset();
  cachedRpcOnJs_.reset();
  cachedRuntime_ = nullptr;
}

void KBBridge::tearup() { isTornDown_.store(false); }

void KBBridge::resetCaches(Runtime &runtime) {
  if (cachedRuntime_ != &runtime) {
    cachedUint8ArrayCtor_.reset();
    cachedRpcOnJs_.reset();
    cachedRuntime_ = &runtime;
  }
}

Function &KBBridge::uint8ArrayCtor(Runtime &runtime) {
  resetCaches(runtime);
  if (!cachedUint8ArrayCtor_) {
    auto ctor = runtime.global().getPropertyAsFunction(runtime, "Uint8Array");
    cachedUint8ArrayCtor_ = std::make_unique<Function>(std::move(ctor));
  }
  return *cachedUint8ArrayCtor_;
}

Value KBBridge::binaryFromBytes(Runtime &runtime, const char *ptr, size_t size,
                                BinaryMode mode) {
  if (mode == BinaryMode::uint8ArrayCtor) {
    Value uint8Array = uint8ArrayCtor(runtime).callAsConstructor(
        runtime, static_cast<double>(size));
    Object uint8ArrayObj = uint8Array.asObject(runtime);
    ArrayBuffer buffer = uint8ArrayObj.getProperty(runtime, "buffer")
                             .asObject(runtime)
                             .getArrayBuffer(runtime);
    if (size > 0) {
      std::memcpy(buffer.data(runtime), ptr, size);
    }
    return uint8Array;
  }

  auto mutableBuffer = std::make_shared<KBMutableBuffer>(size);
  if (size > 0) {
    std::memcpy(mutableBuffer->data(), ptr, size);
  }
  ArrayBuffer arrayBuffer(runtime, mutableBuffer);
  if (mode == BinaryMode::mutableArrayBuffer) {
    return arrayBuffer;
  }

  Value arrayBufferArg(std::move(arrayBuffer));
  return uint8ArrayCtor(runtime).callAsConstructor(runtime,
                                                  std::move(arrayBufferArg));
}

static std::string mpToString(msgpack::object &o) {
  switch (o.type) {
  case msgpack::type::STR:
    return o.as<std::string>();
  case msgpack::type::POSITIVE_INTEGER:
    return std::to_string(o.as<uint64_t>());
  case msgpack::type::NEGATIVE_INTEGER:
    return std::to_string(o.as<int64_t>());
  case msgpack::type::FLOAT32:
    return std::to_string(o.as<double>());
  case msgpack::type::FLOAT64:
    return std::to_string(o.as<double>());
  default:
    throw std::runtime_error("Invalid map key");
  }
}

Value KBBridge::convertMPToJSI(Runtime &runtime, void *mpObj) {
  auto &o = *static_cast<msgpack::object *>(mpObj);
  switch (o.type) {
  case msgpack::type::STR:
    return jsi::String::createFromUtf8(runtime,
        reinterpret_cast<const uint8_t*>(o.via.str.ptr), o.via.str.size);
  case msgpack::type::POSITIVE_INTEGER:
    return jsi::Value(o.as<double>());
  case msgpack::type::NEGATIVE_INTEGER:
    return jsi::Value(o.as<double>());
  case msgpack::type::FLOAT32:
    return jsi::Value(o.as<double>());
  case msgpack::type::FLOAT64:
    return jsi::Value(o.as<double>());
  case msgpack::type::BOOLEAN:
    return jsi::Value(o.as<bool>());
  case msgpack::type::NIL:
    return jsi::Value::null();
  case msgpack::type::EXT:
    return jsi::Value::undefined();
  case msgpack::type::MAP: {
    jsi::Object obj = jsi::Object(runtime);
    auto *p = o.via.map.ptr;
    auto *const pend = o.via.map.ptr + o.via.map.size;
    for (; p < pend; ++p) {
      auto val = convertMPToJSI(runtime, &p->val);
      auto &k = p->key;
      if (k.type == msgpack::type::STR) {
        obj.setProperty(runtime,
            jsi::PropNameID::forUtf8(runtime,
                reinterpret_cast<const uint8_t*>(k.via.str.ptr), k.via.str.size),
            val);
      } else {
        auto keyStr = mpToString(k);
        obj.setProperty(runtime,
            jsi::PropNameID::forUtf8(runtime, keyStr), val);
      }
    }
    return obj;
  }
  case msgpack::type::BIN: {
    auto ptr = o.via.bin.ptr;
    auto size = o.via.bin.size;
#if KB_JSI_INBOUND_BINARY_MODE == 1
    return binaryFromBytes(runtime, ptr, size, BinaryMode::mutableArrayBuffer);
#elif KB_JSI_INBOUND_BINARY_MODE == 2
    return binaryFromBytes(runtime, ptr, size,
                           BinaryMode::mutableWrappedUint8Array);
#else
    return binaryFromBytes(runtime, ptr, size, BinaryMode::uint8ArrayCtor);
#endif
  }
  case msgpack::type::ARRAY: {
    auto size = o.via.array.size;
    jsi::Array arr(runtime, size);
    for (uint32_t i = 0; i < size; ++i) {
      arr.setValueAtIndex(runtime, i,
                          convertMPToJSI(runtime, &o.via.array.ptr[i]));
    }
    return arr;
  }
  default:
    return jsi::Value::undefined();
  }
}

void KBBridge::convertJSIToMP(Runtime &runtime, const Value &value,
                              void *packer) {
  auto &pk = *static_cast<msgpack::packer<msgpack::sbuffer> *>(packer);
  if (value.isNull() || value.isUndefined()) {
    pk.pack_nil();
  } else if (value.isBool()) {
    pk.pack(value.getBool());
  } else if (value.isNumber()) {
    double d = value.getNumber();
    // Doubles can exactly represent integers up to 2^53. Encode exact
    // integers as msgpack int/uint (matching @msgpack/msgpack JS behavior)
    // so Go's decoder sees integer types, not float64.
    if (d == std::floor(d) && std::isfinite(d)) {
      if (d >= 0) {
        pk.pack(static_cast<uint64_t>(d));
      } else {
        pk.pack(static_cast<int64_t>(d));
      }
    } else {
      pk.pack(d);
    }
  } else if (value.isString()) {
    auto str = value.getString(runtime).utf8(runtime);
    pk.pack(str);
  } else if (value.isObject()) {
    auto obj = value.getObject(runtime);
    auto packArrayBufferBytesUnchecked = [&](ArrayBuffer &arrayBuf,
                                             size_t offset, size_t length) {
      pk.pack_bin(static_cast<uint32_t>(length));
      pk.pack_bin_body(
          reinterpret_cast<const char *>(arrayBuf.data(runtime)) + offset,
          static_cast<uint32_t>(length));
    };
    auto packArrayBufferBytes = [&](ArrayBuffer &arrayBuf, size_t offset,
                                    size_t length) {
      auto bufferSize = arrayBuf.size(runtime);
      if (offset > bufferSize || length > bufferSize - offset ||
          length > std::numeric_limits<uint32_t>::max()) {
        throw std::runtime_error("ArrayBuffer view is out of range");
      }
      pk.pack_bin(static_cast<uint32_t>(length));
      pk.pack_bin_body(
          reinterpret_cast<const char *>(arrayBuf.data(runtime)) + offset,
          static_cast<uint32_t>(length));
    };
    if (obj.isArrayBuffer(runtime)) {
      auto buf = obj.getArrayBuffer(runtime);
#if KB_JSI_OUTBOUND_TYPED_ARRAY_FASTPATH
      packArrayBufferBytes(buf, 0, buf.size(runtime));
#else
      packArrayBufferBytesUnchecked(buf, 0, buf.size(runtime));
#endif
    } else if (obj.isArray(runtime)) {
      auto arr = obj.getArray(runtime);
      auto len = arr.size(runtime);
      pk.pack_array(static_cast<uint32_t>(len));
      for (size_t i = 0; i < len; ++i) {
        convertJSIToMP(runtime, arr.getValueAtIndex(runtime, i), &pk);
      }
    } else {
      auto tryPackTypedArray = [&](bool requireUint8Array,
                                   bool validateView) -> bool {
        if (requireUint8Array &&
            !obj.instanceOf(runtime, uint8ArrayCtor(runtime))) {
          return false;
        }
        auto byteLengthProp = obj.getProperty(runtime, "byteLength");
        if (!byteLengthProp.isNumber()) return false;
        auto bufferProp = obj.getProperty(runtime, "buffer");
        if (!bufferProp.isObject()) return false;
        auto bufferObj = bufferProp.asObject(runtime);
        if (!bufferObj.isArrayBuffer(runtime)) return false;
        auto arrayBuf = bufferObj.getArrayBuffer(runtime);
        auto byteOffset = obj.getProperty(runtime, "byteOffset");
        auto byteLengthNum = byteLengthProp.getNumber();
        auto byteOffsetNum =
            byteOffset.isNumber() ? byteOffset.getNumber() : 0;
        if (validateView) {
          if (!std::isfinite(byteOffsetNum) ||
              !std::isfinite(byteLengthNum) || byteOffsetNum < 0 ||
              byteLengthNum < 0 || byteOffsetNum != std::floor(byteOffsetNum) ||
              byteLengthNum != std::floor(byteLengthNum)) {
            return false;
          }
          auto offset = static_cast<size_t>(byteOffsetNum);
          auto length = static_cast<size_t>(byteLengthNum);
          packArrayBufferBytes(arrayBuf, offset, length);
        } else {
          auto offset = static_cast<size_t>(byteOffsetNum);
          auto length = static_cast<size_t>(byteLengthNum);
          packArrayBufferBytesUnchecked(arrayBuf, offset, length);
        }
        return true;
      };

#if KB_JSI_OUTBOUND_TYPED_ARRAY_FASTPATH
      if (tryPackTypedArray(true, true)) {
        return;
      }
#endif

      auto names = obj.getPropertyNames(runtime);
      auto len = names.size(runtime);

      // Empty object: could be {} or empty TypedArray — must probe
      if (len == 0) {
        if (tryPackTypedArray(false, false)) return;
        pk.pack_map(0);
        return;
      }

      // Get first property name (needed for MAP encoding anyway).
      // TypedArrays have numeric index keys ("0", "1", ...); regular
      // RPC objects have string keys. Only probe for TypedArray when
      // the first key looks numeric — saves a JSI call per regular object.
      auto firstName = names.getValueAtIndex(runtime, 0).getString(runtime);
      auto firstStr = firstName.utf8(runtime);
      if (!firstStr.empty() && firstStr[0] >= '0' && firstStr[0] <= '9') {
        if (tryPackTypedArray(false, false)) return;
      }

      // Regular object — encode as MAP
      pk.pack_map(static_cast<uint32_t>(len));
      pk.pack(firstStr);
      convertJSIToMP(runtime, obj.getProperty(runtime, firstName), &pk);
      for (size_t i = 1; i < len; ++i) {
        auto name = names.getValueAtIndex(runtime, i).getString(runtime);
        auto nameStr = name.utf8(runtime);
        pk.pack(nameStr);
        convertJSIToMP(runtime, obj.getProperty(runtime, name), &pk);
      }
    }
  }
}

#ifdef KB_JSI_EXPERIMENTS_ENABLED
void KBBridge::installExperimentBindings(Runtime &runtime) {
  Object config(runtime);
  config.setProperty(runtime, "inboundBinaryMode",
                     static_cast<double>(KB_JSI_INBOUND_BINARY_MODE));
  config.setProperty(runtime, "outboundTypedArrayFastPath",
                     static_cast<bool>(KB_JSI_OUTBOUND_TYPED_ARRAY_FASTPATH));
#if KB_JSI_PERF
  config.setProperty(runtime, "perf", true);
#else
  config.setProperty(runtime, "perf", false);
#endif

  const char *inboundBinaryModeName = "uint8ArrayCtor";
#if KB_JSI_INBOUND_BINARY_MODE == 1
  inboundBinaryModeName = "mutableArrayBuffer";
#elif KB_JSI_INBOUND_BINARY_MODE == 2
  inboundBinaryModeName = "mutableWrappedUint8Array";
#endif
  config.setProperty(runtime, "inboundBinaryModeName",
                     String::createFromUtf8(runtime, inboundBinaryModeName));
  runtime.global().setProperty(runtime, "kbJSIExperimentConfig",
                               std::move(config));
}
#endif

#if KB_JSI_PERF
void KBBridge::resetPerfCounters() {
  perf_.rpcOnGoCalls.store(0);
  perf_.rpcOnGoBytes.store(0);
  perf_.encodeNs.store(0);
  perf_.frameNs.store(0);
  perf_.writeToGoNs.store(0);
  perf_.onDataCalls.store(0);
  perf_.onDataBytes.store(0);
  perf_.inboundMessages.store(0);
  perf_.unpackNs.store(0);
  perf_.convertMPToJSINs.store(0);
  perf_.rpcOnJsCalls.store(0);
  perf_.rpcOnJsNs.store(0);
}

Value KBBridge::perfStats(Runtime &runtime) {
  Object stats(runtime);
  stats.setProperty(runtime, "rpcOnGoCalls",
                    static_cast<double>(perf_.rpcOnGoCalls.load()));
  stats.setProperty(runtime, "rpcOnGoBytes",
                    static_cast<double>(perf_.rpcOnGoBytes.load()));
  stats.setProperty(runtime, "encodeNs",
                    static_cast<double>(perf_.encodeNs.load()));
  stats.setProperty(runtime, "frameNs",
                    static_cast<double>(perf_.frameNs.load()));
  stats.setProperty(runtime, "writeToGoNs",
                    static_cast<double>(perf_.writeToGoNs.load()));
  stats.setProperty(runtime, "onDataCalls",
                    static_cast<double>(perf_.onDataCalls.load()));
  stats.setProperty(runtime, "onDataBytes",
                    static_cast<double>(perf_.onDataBytes.load()));
  stats.setProperty(runtime, "inboundMessages",
                    static_cast<double>(perf_.inboundMessages.load()));
  stats.setProperty(runtime, "unpackNs",
                    static_cast<double>(perf_.unpackNs.load()));
  stats.setProperty(runtime, "convertMPToJSINs",
                    static_cast<double>(perf_.convertMPToJSINs.load()));
  stats.setProperty(runtime, "rpcOnJsCalls",
                    static_cast<double>(perf_.rpcOnJsCalls.load()));
  stats.setProperty(runtime, "rpcOnJsNs",
                    static_cast<double>(perf_.rpcOnJsNs.load()));
  stats.setProperty(runtime, "runtime",
                    String::createFromUtf8(runtime, runtime.description()));
  return stats;
}

Value KBBridge::convertMPToJSIPerf(Runtime &runtime, void *mpObj,
                                   BinaryMode mode) {
  auto &o = *static_cast<msgpack::object *>(mpObj);
  switch (o.type) {
  case msgpack::type::STR:
    return jsi::String::createFromUtf8(
        runtime, reinterpret_cast<const uint8_t *>(o.via.str.ptr),
        o.via.str.size);
  case msgpack::type::POSITIVE_INTEGER:
    return jsi::Value(o.as<double>());
  case msgpack::type::NEGATIVE_INTEGER:
    return jsi::Value(o.as<double>());
  case msgpack::type::FLOAT32:
    return jsi::Value(o.as<double>());
  case msgpack::type::FLOAT64:
    return jsi::Value(o.as<double>());
  case msgpack::type::BOOLEAN:
    return jsi::Value(o.as<bool>());
  case msgpack::type::NIL:
    return jsi::Value::null();
  case msgpack::type::EXT:
    return jsi::Value::undefined();
  case msgpack::type::MAP: {
    jsi::Object obj = jsi::Object(runtime);
    auto *p = o.via.map.ptr;
    auto *const pend = o.via.map.ptr + o.via.map.size;
    for (; p < pend; ++p) {
      auto val = convertMPToJSIPerf(runtime, &p->val, mode);
      auto &k = p->key;
      if (k.type == msgpack::type::STR) {
        obj.setProperty(
            runtime,
            jsi::PropNameID::forUtf8(
                runtime, reinterpret_cast<const uint8_t *>(k.via.str.ptr),
                k.via.str.size),
            val);
      } else {
        auto keyStr = mpToString(k);
        obj.setProperty(runtime, jsi::PropNameID::forUtf8(runtime, keyStr),
                        val);
      }
    }
    return obj;
  }
  case msgpack::type::BIN:
    return binaryFromBytes(runtime, o.via.bin.ptr, o.via.bin.size, mode);
  case msgpack::type::ARRAY: {
    auto size = o.via.array.size;
    jsi::Array arr(runtime, size);
    for (uint32_t i = 0; i < size; ++i) {
      arr.setValueAtIndex(
          runtime, i, convertMPToJSIPerf(runtime, &o.via.array.ptr[i], mode));
    }
    return arr;
  }
  default:
    return jsi::Value::undefined();
  }
}

Value KBBridge::perfMakeBinary(Runtime &runtime, const Value *arguments,
                               size_t count) {
  auto size = count > 0 && arguments[0].isNumber()
                  ? static_cast<size_t>(arguments[0].getNumber())
                  : 1024;
  if (size > std::numeric_limits<uint32_t>::max()) {
    throw std::runtime_error("kbJSIPerf.makeBinary size is too large");
  }

  auto mode = BinaryMode::uint8ArrayCtor;
  if (count > 1 && arguments[1].isString()) {
    auto modeName = arguments[1].getString(runtime).utf8(runtime);
    if (modeName == "arrayBuffer") {
      mode = BinaryMode::mutableArrayBuffer;
    } else if (modeName == "wrappedUint8Array") {
      mode = BinaryMode::mutableWrappedUint8Array;
    }
  }

  auto bytes = std::make_shared<KBMutableBuffer>(size);
  fillPerfBytes(bytes->data(), size);
  return binaryFromBytes(runtime, reinterpret_cast<const char *>(bytes->data()),
                         size, mode);
}

Value KBBridge::perfRoundTrip(Runtime &runtime, const Value *arguments,
                              size_t count) {
  if (count == 0) {
    throw std::runtime_error("kbJSIPerf.roundTrip needs a value");
  }

  auto iterations = count > 1 && arguments[1].isNumber()
                        ? static_cast<size_t>(arguments[1].getNumber())
                        : 100;
  if (iterations == 0) {
    iterations = 1;
  }

  auto mode = BinaryMode::uint8ArrayCtor;
  const char *modeName = "uint8Array";
  if (count > 2 && arguments[2].isString()) {
    auto modeArg = arguments[2].getString(runtime).utf8(runtime);
    if (modeArg == "arrayBuffer") {
      mode = BinaryMode::mutableArrayBuffer;
      modeName = "arrayBuffer";
    } else if (modeArg == "wrappedUint8Array") {
      mode = BinaryMode::mutableWrappedUint8Array;
      modeName = "wrappedUint8Array";
    }
  }

  msgpack::sbuffer encoded;
  auto encodeStart = KBPerfClock::now();
  for (size_t i = 0; i < iterations; ++i) {
    encoded.clear();
    msgpack::packer<msgpack::sbuffer> pk(&encoded);
    convertJSIToMP(runtime, arguments[0], &pk);
  }
  auto encodeNs = perfNanosSince(encodeStart);

  std::string encodedBytes(encoded.data(), encoded.size());
  Value lastValue = Value::undefined();
  auto decodeStart = KBPerfClock::now();
  for (size_t i = 0; i < iterations; ++i) {
    auto unpacked =
        msgpack::unpack(encodedBytes.data(), encodedBytes.size());
    msgpack::object obj(unpacked.get());
    lastValue = convertMPToJSIPerf(runtime, &obj, mode);
  }
  auto decodeNs = perfNanosSince(decodeStart);

  Object result(runtime);
  result.setProperty(runtime, "iterations", static_cast<double>(iterations));
  result.setProperty(runtime, "bytes", static_cast<double>(encodedBytes.size()));
  result.setProperty(runtime, "encodeNs", static_cast<double>(encodeNs));
  result.setProperty(runtime, "decodeNs", static_cast<double>(decodeNs));
  result.setProperty(runtime, "mode", String::createFromUtf8(runtime, modeName));
  result.setProperty(runtime, "value", std::move(lastValue));
  return result;
}

void KBBridge::installPerfBindings(Runtime &runtime) {
  Object perf(runtime);
  perf.setProperty(
      runtime, "stats",
      Function::createFromHostFunction(
          runtime, PropNameID::forAscii(runtime, "stats"), 0,
          [self = shared_from_this()](Runtime &runtime, const Value &,
                                      const Value *, size_t) -> Value {
            return self->perfStats(runtime);
          }));
  perf.setProperty(
      runtime, "reset",
      Function::createFromHostFunction(
          runtime, PropNameID::forAscii(runtime, "reset"), 0,
          [self = shared_from_this()](Runtime &, const Value &, const Value *,
                                      size_t) -> Value {
            self->resetPerfCounters();
            return Value(true);
          }));
  perf.setProperty(
      runtime, "roundTrip",
      Function::createFromHostFunction(
          runtime, PropNameID::forAscii(runtime, "roundTrip"), 3,
          [self = shared_from_this()](Runtime &runtime, const Value &,
                                      const Value *arguments,
                                      size_t count) -> Value {
            return self->perfRoundTrip(runtime, arguments, count);
          }));
  perf.setProperty(
      runtime, "makeBinary",
      Function::createFromHostFunction(
          runtime, PropNameID::forAscii(runtime, "makeBinary"), 2,
          [self = shared_from_this()](Runtime &runtime, const Value &,
                                      const Value *arguments,
                                      size_t count) -> Value {
            return self->perfMakeBinary(runtime, arguments, count);
          }));
  runtime.global().setProperty(runtime, "kbJSIPerf", std::move(perf));
}
#endif

void KBBridge::packAndSend(Runtime &runtime, const Value &value) {
  mp_->sendBuf.clear();
  msgpack::packer<msgpack::sbuffer> pk(&mp_->sendBuf);
#if KB_JSI_PERF
  auto encodeStart = KBPerfClock::now();
#endif
  convertJSIToMP(runtime, value, &pk);
#if KB_JSI_PERF
  perf_.encodeNs.fetch_add(perfNanosSince(encodeStart));
#endif

#if KB_JSI_PERF
  auto frameStart = KBPerfClock::now();
#endif
  // Encode frame header (msgpack uint32 length prefix) on the stack.
  // 0xce = msgpack uint32 format tag, followed by 4 big-endian bytes.
  auto contentSize = static_cast<uint32_t>(mp_->sendBuf.size());
  uint8_t frameHeader[5] = {
    0xce,
    static_cast<uint8_t>(contentSize >> 24),
    static_cast<uint8_t>(contentSize >> 16),
    static_cast<uint8_t>(contentSize >> 8),
    static_cast<uint8_t>(contentSize),
  };
  constexpr size_t headerLen = 5;

  combinedBuf_.resize(headerLen + mp_->sendBuf.size());
  std::memcpy(combinedBuf_.data(), frameHeader, headerLen);
  std::memcpy(combinedBuf_.data() + headerLen, mp_->sendBuf.data(), mp_->sendBuf.size());
#if KB_JSI_PERF
  perf_.frameNs.fetch_add(perfNanosSince(frameStart));
  perf_.rpcOnGoCalls.fetch_add(1);
  perf_.rpcOnGoBytes.fetch_add(combinedBuf_.size());
  auto writeStart = KBPerfClock::now();
#endif

  writeToGo_(combinedBuf_.data(), combinedBuf_.size());
#if KB_JSI_PERF
  perf_.writeToGoNs.fetch_add(perfNanosSince(writeStart));
#endif
}

void KBBridge::install(
    Runtime &runtime,
    std::shared_ptr<facebook::react::CallInvoker> callInvoker,
    std::function<void(void *ptr, size_t size)> writeToGo,
    std::function<void(const std::string &)> onError) {
  callInvoker_ = std::move(callInvoker);
  onError_ = std::move(onError);
  writeToGo_ = std::move(writeToGo);
  mp_ = std::make_unique<MsgpackState>();

  auto rpcOnGo = Function::createFromHostFunction(
      runtime, PropNameID::forAscii(runtime, "rpcOnGo"), 1,
      [self = shared_from_this()](Runtime &runtime, const Value &thisValue,
                                  const Value *arguments,
                                  size_t count) -> Value {
        try {
          self->packAndSend(runtime, arguments[0]);
          return Value(true);
        } catch (const std::exception &e) {
          throw std::runtime_error("Error in rpcOnGo: " +
                                   std::string(e.what()));
        } catch (...) {
          throw std::runtime_error("Unknown error in rpcOnGo");
        }
      });

  runtime.global().setProperty(runtime, "rpcOnGo", std::move(rpcOnGo));

#ifdef KB_JSI_EXPERIMENTS_ENABLED
  installExperimentBindings(runtime);
#endif
#if KB_JSI_PERF
  installPerfBindings(runtime);
#endif

  // HostObject that calls teardown when the JS runtime is destroyed
  class KBTearDownSimple : public jsi::HostObject {
  public:
    KBTearDownSimple(std::weak_ptr<KBBridge> bridge) : bridge_(bridge) {
      if (auto b = bridge_.lock()) {
        b->tearup();
      }
    }
    ~KBTearDownSimple() override {
      if (auto b = bridge_.lock()) {
        b->teardown();
      }
    }
    Value get(Runtime &, const PropNameID &) override {
      return Value::undefined();
    }
    void set(Runtime &, const PropNameID &, const Value &) override {}
    std::vector<PropNameID> getPropertyNames(Runtime &) override { return {}; }

  private:
    std::weak_ptr<KBBridge> bridge_;
  };

  runtime.global().setProperty(
      runtime, "kbTeardown",
      Object::createFromHostObject(
          runtime,
          std::make_shared<KBTearDownSimple>(shared_from_this())));
}

void KBBridge::onDataFromGo(uint8_t *data, int size) {
  if (isTornDown_.load() || size <= 0) {
    return;
  }

  try {
    auto values = std::make_shared<std::vector<msgpack::object_handle>>();
#if KB_JSI_PERF
    auto unpackStart = KBPerfClock::now();
#endif
    mp_->unpacker.reserve_buffer(size);
    std::copy(data, data + size, mp_->unpacker.buffer());
    mp_->unpacker.buffer_consumed(size);
    while (true) {
      msgpack::object_handle result;
      if (mp_->unpacker.next(result)) {
        if (readState_ == ReadState::needSize) {
          readState_ = ReadState::needContent;
        } else {
          values->push_back(std::move(result));
          readState_ = ReadState::needSize;
        }
      } else {
        break;
      }
    }
#if KB_JSI_PERF
    perf_.onDataCalls.fetch_add(1);
    perf_.onDataBytes.fetch_add(static_cast<uint64_t>(size));
    perf_.unpackNs.fetch_add(perfNanosSince(unpackStart));
    perf_.inboundMessages.fetch_add(values->size());
#endif

    if (values->empty()) {
      return;
    }

    auto self = shared_from_this();
    callInvoker_->invokeAsync([values, self](jsi::Runtime &runtime) {
      try {
        if (self->isTornDown_.load()) {
          return;
        }

        self->resetCaches(runtime);
        if (!self->cachedRpcOnJs_) {
          try {
            auto func =
                runtime.global().getPropertyAsFunction(runtime, "rpcOnJs");
            self->cachedRpcOnJs_ =
                std::make_unique<Function>(std::move(func));
          } catch (...) {
            if (self->onError_) {
              self->onError_("Failed to get rpcOnJs function");
            }
            return;
          }
        }

        if (values->size() == 1) {
#if KB_JSI_PERF
          auto convertStart = KBPerfClock::now();
#endif
          // Single message: pass directly (no array wrapper)
          msgpack::object obj((*values)[0].get());
          Value value = self->convertMPToJSI(runtime, &obj);
#if KB_JSI_PERF
          self->perf_.convertMPToJSINs.fetch_add(
              perfNanosSince(convertStart));
#endif
          if (self->isTornDown_.load()) {
            return;
          }
#if KB_JSI_PERF
          auto callStart = KBPerfClock::now();
#endif
          self->cachedRpcOnJs_->call(runtime, std::move(value),
                                     jsi::Value(1));
#if KB_JSI_PERF
          self->perf_.rpcOnJsCalls.fetch_add(1);
          self->perf_.rpcOnJsNs.fetch_add(perfNanosSince(callStart));
#endif
        } else {
#if KB_JSI_PERF
          auto convertStart = KBPerfClock::now();
#endif
          // Multiple messages: batch into array, pass count
          jsi::Array arr(runtime, values->size());
          for (size_t i = 0; i < values->size(); ++i) {
            msgpack::object obj((*values)[i].get());
            arr.setValueAtIndex(runtime, i,
                                self->convertMPToJSI(runtime, &obj));
          }
#if KB_JSI_PERF
          self->perf_.convertMPToJSINs.fetch_add(
              perfNanosSince(convertStart));
#endif
          if (self->isTornDown_.load()) {
            return;
          }
#if KB_JSI_PERF
          auto callStart = KBPerfClock::now();
#endif
          self->cachedRpcOnJs_->call(
              runtime, std::move(arr),
              jsi::Value(static_cast<int>(values->size())));
#if KB_JSI_PERF
          self->perf_.rpcOnJsCalls.fetch_add(1);
          self->perf_.rpcOnJsNs.fetch_add(perfNanosSince(callStart));
#endif
        }
      } catch (const std::exception &e) {
        if (self->onError_) {
          self->onError_(e.what());
        }
      } catch (...) {
        if (self->onError_) {
          self->onError_("unknown error in onDataFromGo JS callback");
        }
      }
    });
  } catch (const std::exception &e) {
    if (onError_) {
      onError_(std::string("Error in onDataFromGo: ") + e.what());
    }
  } catch (...) {
    if (onError_) {
      onError_("Unknown error in onDataFromGo");
    }
  }
}

} // namespace kb
