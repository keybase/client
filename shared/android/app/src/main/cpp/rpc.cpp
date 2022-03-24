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
  auto obj = arguments[0].asObject(runtime);
  auto buffer = obj.getArrayBuffer(runtime);
  auto ptr = buffer.data(runtime);
  auto size = buffer.size(runtime);
  callback(ptr, size);
  return Value(true);
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
  }
  throw new std::runtime_error("Invalid map key");
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

void RpcOnJS(Runtime &runtime, std::shared_ptr<uint8_t> data, int size) {
  // TODO buffer locally or get the whole thing?
  auto dataPtr = (const char *)data.get();
  size_t offset = 0;
  msgpack::object_handle oh = msgpack::unpack(dataPtr, size, offset);
  msgpack::object obj = oh.get();
  Function rpcOnJs2 =
      runtime.global().getPropertyAsFunction(runtime, "rpcOnJs");
  msgpack::object_handle oh2 = msgpack::unpack(dataPtr, size, offset);
  auto obj2 = oh2.get();
  Value v = convertMPToJSI(runtime, obj2);
  rpcOnJs2.call(runtime, move(v), 1);
}
