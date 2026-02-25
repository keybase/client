#include "react-native-kb.h"
#include <cstring>
#include <string>

using namespace facebook;
using namespace facebook::jsi;

namespace kb {

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
    return std::to_string(o.as<unsigned int>());
  case msgpack::type::NEGATIVE_INTEGER:
    return std::to_string(o.as<int>());
  case msgpack::type::FLOAT32:
    return std::to_string(o.as<double>());
  case msgpack::type::FLOAT64:
    return std::to_string(o.as<double>());
  default:
    throw std::runtime_error("Invalid map key");
  }
}

Value KBBridge::convertMPToJSI(Runtime &runtime, msgpack::object &o) {
  switch (o.type) {
  case msgpack::type::STR:
    return jsi::String::createFromUtf8(runtime, o.as<std::string>());
  case msgpack::type::POSITIVE_INTEGER:
    return jsi::Value(o.as<double>());
  case msgpack::type::NEGATIVE_INTEGER:
    return jsi::Value(o.as<int>());
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
      auto key = mpToString(p->key);
      auto val = convertMPToJSI(runtime, p->val);
      obj.setProperty(runtime, jsi::String::createFromUtf8(runtime, key), val);
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
                          convertMPToJSI(runtime, o.via.array.ptr[i]));
    }
    return arr;
  }
  default:
    return jsi::Value::undefined();
  }
}

void KBBridge::install(
    Runtime &runtime,
    std::shared_ptr<facebook::react::CallInvoker> callInvoker,
    std::function<void(void *ptr, size_t size)> writeToGo,
    std::function<void(const std::string &)> onError) {
  callInvoker_ = std::move(callInvoker);
  onError_ = std::move(onError);

  auto rpcOnGo = Function::createFromHostFunction(
      runtime, PropNameID::forAscii(runtime, "rpcOnGo"), 1,
      [writeToGo = std::move(writeToGo)](Runtime &runtime,
                                         const Value &thisValue,
                                         const Value *arguments,
                                         size_t count) -> Value {
        try {
          auto obj = arguments[0].asObject(runtime);
          auto buffer = obj.getArrayBuffer(runtime);
          auto ptr = buffer.data(runtime);
          auto size = buffer.size(runtime);
          writeToGo(ptr, size);
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
    unpacker_.reserve_buffer(size);
    std::copy(data, data + size, unpacker_.buffer());
    unpacker_.buffer_consumed(size);
    while (true) {
      msgpack::object_handle result;
      if (unpacker_.next(result)) {
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

        for (auto &result : *values) {
          msgpack::object obj(result.get());
          Value value = self->convertMPToJSI(runtime, obj);
          if (self->isTornDown_.load()) {
            return;
          }
          self->cachedRpcOnJs_->call(runtime, std::move(value), 1);
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
