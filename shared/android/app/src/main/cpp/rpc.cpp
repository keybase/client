#include "rpc.h"
#include <chrono>
#include <jsi/jsi.h>
#include <msgpack.hpp>
#include <string>

using namespace facebook;
using namespace facebook::jsi;
using namespace std;

Value RpcOnGo(Runtime &runtime, const Value &thisValue, const Value *arguments,
              size_t count, void (*callback)(void *ptr, size_t size)) {
  try {
    auto obj = arguments[0].asObject(runtime);
    auto buffer = obj.getArrayBuffer(runtime);
    auto ptr = buffer.data(runtime);
    auto size = buffer.size(runtime);
    callback(ptr, size);
    return Value(true);
  } catch (const std::exception &e) {
    throw new std::runtime_error("Error in RpcOnGo: " + string(e.what()));
  } catch (...) {
    throw new std::runtime_error("Unknown error in RpcOnGo");
  }
}

std::string mpToString(msgpack::object &o) {
  switch (o.type) {
  case msgpack::type::STR:
    return o.as<std::string>();
  case msgpack::type::POSITIVE_INTEGER:
    return std::to_string(o.as<double>());
  case msgpack::type::NEGATIVE_INTEGER:
    return std::to_string(o.as<int>());
  case msgpack::type::FLOAT32:
    return std::to_string(o.as<double>());
  case msgpack::type::FLOAT64:
    return std::to_string(o.as<double>());
  default:
    throw new std::runtime_error("Invalid map key");
  }
}

Value convertMPToJSI(Runtime &runtime, msgpack::object &o) {
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
      obj.setProperty(runtime, key.c_str(), val);
    }
    return obj;
  }
  case msgpack::type::BIN: {
    auto ptr = o.via.bin.ptr;
    int size = o.via.bin.size;
    Function arrayBufferCtor =
        runtime.global().getPropertyAsFunction(runtime, "ArrayBuffer");
    Value v = arrayBufferCtor.callAsConstructor(runtime, size);
    Object o = v.getObject(runtime);
    ArrayBuffer buf = o.getArrayBuffer(runtime);
    std::memcpy(buf.data(runtime), ptr, size);
    return v;
  }
  case msgpack::type::ARRAY: {
    auto size = o.via.array.size;
    jsi::Array arr(runtime, size);
    for (int i = 0; i < size; ++i) {
      arr.setValueAtIndex(runtime, i,
                          convertMPToJSI(runtime, o.via.array.ptr[i]));
    }
    return arr;
  }
  default:
    return jsi::Value::undefined();
  }
}

enum class ReadState { needSize, needContent };
ReadState g_state = ReadState::needSize;
// holds leftover data
std::vector<uint8_t> g_buffer;
int g_payloadSize = -1;

void RpcOnJS(Runtime &runtime, std::shared_ptr<uint8_t> data, int size) {
  try {
    printf("aaa rpconjs, \nsize %d\ngsize: %d\npayloadsize: %d\n", size,
           g_buffer.size(), g_payloadSize);
    auto dataPtr = data.get();
    size_t offset = 0;
    Function rpcOnJs2 =
        runtime.global().getPropertyAsFunction(runtime, "rpcOnJs");

    // use g_buffer if there's something in it already
    if (!g_buffer.empty()) {
      printf("aaa rpconjs using bguffer\n");
      std::copy(data.get(), data.get() + size, back_inserter(g_buffer));
      dataPtr = &g_buffer[0];
      size = g_buffer.size() + size;
    }

    // keep consuming until the buffer is empty
    while (offset < size) {
      printf("aaa rpconjs looping off: %d size: %d\n", offset, size);
      // get the next payload size
      if (g_state == ReadState::needSize) {
        try {
          msgpack::object_handle oh =
              msgpack::unpack((const char *)dataPtr, size, offset);
          msgpack::object obj = oh.get();
          g_payloadSize = obj.as<int>();
        } catch (...) {
          // TEMP logging
          printf("aaa bail on reading size, should be ok\n");
          break;
        }
        g_state = ReadState::needContent;
      }

      // have enough data?
      if ((size - offset) >= g_payloadSize) {
        printf("aaa rpconjs consuming payload\n");
        msgpack::object_handle oh2 =
            msgpack::unpack((const char *)dataPtr, size, offset);
        g_state = ReadState::needSize;
        g_payloadSize = -1;
        auto obj2 = oh2.get();
        Value v = convertMPToJSI(runtime, obj2);
        rpcOnJs2.call(runtime, move(v), 1);
      } else {
        printf("aaa rpconjs not enough data break\n");
        break;
      }
    }

    // leftover data?
    if (offset < size) {
      printf("aaa rpconjs leftovers off: %d size: %d\n", offset, size);
      // handle if dataPtr = g_buffer
      g_buffer.clear();
      std::copy(&dataPtr[offset], &dataPtr[size], back_inserter(g_buffer));
    } else {
      // TODO handle this
    }
  } catch (const std::exception &e) {
    throw new std::runtime_error("Error in RpcOnJS: " + string(e.what()));
  } catch (...) {
    throw new std::runtime_error("Unknown error in RpcOnJS");
  }
}
