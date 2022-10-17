#include "rpc.h"
#include <chrono>
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
    return std::to_string(o.as<unsigned int>());
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
    // make ArrayBuffer and copy in data
    Function arrayBufferCtor =
        runtime.global().getPropertyAsFunction(runtime, "ArrayBuffer");
    Value ab = arrayBufferCtor.callAsConstructor(runtime, size);
    Object abo = ab.getObject(runtime);
    ArrayBuffer abbuf = abo.getArrayBuffer(runtime);
    std::copy(ptr, ptr + size, abbuf.data(runtime));

    // Wrap in Buffer like framed-msg-pack
    Object bufObj = runtime.global().getPropertyAsObject(runtime, "Buffer");
    Function bufFrom = bufObj.getPropertyAsFunction(runtime, "from");
    Value buf = bufFrom.callWithThis(
        runtime, bufObj,
        std::move(ab)); // Buffer shares the memory and just wraps
    return buf;
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
msgpack::unpacker unp;

ShareValues PrepRpcOnJS(Runtime &runtime, uint8_t *data, int size) {
  try {
    auto values = make_shared<std::vector<msgpack::object_handle>>();
    if (size > 0) {
      unp.reserve_buffer(size);
      std::copy(data, data + size, unp.buffer());
      unp.buffer_consumed(size);
      while (true) {
        msgpack::object_handle result;
        if (unp.next(result)) {
          if (g_state == ReadState::needSize) {
            g_state = ReadState::needContent;
          } else {
            values->push_back(move(result));
            g_state = ReadState::needSize;
          }
        } else {
          break;
        }
      }
    }
    return values;
  } catch (const std::exception &e) {
    throw new std::runtime_error("Error in PrepRpcOnJS: " + string(e.what()));
  } catch (...) {
    throw new std::runtime_error("Unknown error in PrepRpcOnJS");
  }
}

void RpcOnJS(Runtime &runtime, ShareValues values,
             void (*err_callback)(const std::string &err)) {
  try {
    Function rpcOnJs =
        runtime.global().getPropertyAsFunction(runtime, "rpcOnJs");
    for (auto &result : *values) {
      msgpack::object obj(result.get());
      Value value = convertMPToJSI(runtime, obj);
      rpcOnJs.call(runtime, move(value), 1);
    }
  } catch (const std::exception &e) {
    err_callback(e.what());
    throw new std::runtime_error("Error in RpcOnJS: " + string(e.what()));
  } catch (...) {
    err_callback("unknown error");
    throw new std::runtime_error("Unknown error in RpcOnJS");
  }
}
