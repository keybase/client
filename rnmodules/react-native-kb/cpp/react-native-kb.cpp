#include "react-native-kb.h"
#include <cmath>
#include <cstring>
#include "msgpack-safe.hpp"
#include <string>

using namespace facebook;
using namespace facebook::jsi;

namespace kb {

struct KBBridge::MsgpackState {
  msgpack::unpacker unpacker;
  msgpack::sbuffer sendBuf;
};

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
    int size = o.via.bin.size;

    resetCaches(runtime);
    if (!cachedUint8ArrayCtor_) {
      auto ctor =
          runtime.global().getPropertyAsFunction(runtime, "Uint8Array");
      cachedUint8ArrayCtor_ = std::make_unique<Function>(std::move(ctor));
    }

    Value uint8Array =
        cachedUint8ArrayCtor_->callAsConstructor(runtime, size);
    Object uint8ArrayObj = uint8Array.asObject(runtime);
    ArrayBuffer buffer = uint8ArrayObj.getProperty(runtime, "buffer")
                             .asObject(runtime)
                             .getArrayBuffer(runtime);
    std::memcpy(buffer.data(runtime), ptr, size);
    return uint8Array;
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
    if (obj.isArrayBuffer(runtime)) {
      auto buf = obj.getArrayBuffer(runtime);
      pk.pack_bin(static_cast<uint32_t>(buf.size(runtime)));
      pk.pack_bin_body(reinterpret_cast<const char *>(buf.data(runtime)),
                       static_cast<uint32_t>(buf.size(runtime)));
    } else if (obj.isArray(runtime)) {
      auto arr = obj.getArray(runtime);
      auto len = arr.size(runtime);
      pk.pack_array(static_cast<uint32_t>(len));
      for (size_t i = 0; i < len; ++i) {
        convertJSIToMP(runtime, arr.getValueAtIndex(runtime, i), &pk);
      }
    } else {
      // Check for Uint8Array: has "byteLength" and "buffer" properties
      // where "buffer" is an ArrayBuffer
      auto byteLengthProp = obj.getProperty(runtime, "byteLength");
      if (byteLengthProp.isNumber()) {
        auto bufferProp = obj.getProperty(runtime, "buffer");
        if (bufferProp.isObject()) {
          auto bufferObj = bufferProp.asObject(runtime);
          if (bufferObj.isArrayBuffer(runtime)) {
            // This is a TypedArray (Uint8Array) — encode as BIN
            auto arrayBuf = bufferObj.getArrayBuffer(runtime);
            auto byteOffset = obj.getProperty(runtime, "byteOffset");
            size_t offset = byteOffset.isNumber()
                                ? static_cast<size_t>(byteOffset.getNumber())
                                : 0;
            size_t length = static_cast<size_t>(byteLengthProp.getNumber());
            pk.pack_bin(static_cast<uint32_t>(length));
            pk.pack_bin_body(
                reinterpret_cast<const char *>(arrayBuf.data(runtime)) + offset,
                static_cast<uint32_t>(length));
            return;
          }
        }
      }
      // Regular object — encode as MAP
      auto names = obj.getPropertyNames(runtime);
      auto len = names.size(runtime);
      pk.pack_map(static_cast<uint32_t>(len));
      for (size_t i = 0; i < len; ++i) {
        auto name = names.getValueAtIndex(runtime, i).getString(runtime);
        auto nameStr = name.utf8(runtime);
        pk.pack(nameStr);
        convertJSIToMP(runtime, obj.getProperty(runtime, name), &pk);
      }
    }
  }
}

void KBBridge::packAndSend(Runtime &runtime, const Value &value) {
  mp_->sendBuf.clear();
  msgpack::packer<msgpack::sbuffer> pk(&mp_->sendBuf);
  convertJSIToMP(runtime, value, &pk);

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

  writeToGo_(combinedBuf_.data(), combinedBuf_.size());
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
          // Single message: pass directly (no array wrapper)
          msgpack::object obj((*values)[0].get());
          Value value = self->convertMPToJSI(runtime, &obj);
          if (self->isTornDown_.load()) {
            return;
          }
          self->cachedRpcOnJs_->call(runtime, std::move(value),
                                     jsi::Value(1));
        } else {
          // Multiple messages: batch into array, pass count
          jsi::Array arr(runtime, values->size());
          for (size_t i = 0; i < values->size(); ++i) {
            msgpack::object obj((*values)[i].get());
            arr.setValueAtIndex(runtime, i,
                                self->convertMPToJSI(runtime, &obj));
          }
          if (self->isTornDown_.load()) {
            return;
          }
          self->cachedRpcOnJs_->call(
              runtime, std::move(arr),
              jsi::Value(static_cast<int>(values->size())));
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
