#include "rpc.h"
#include <chrono>
#include <jsi/jsi.h>
#include <msgpack.hpp>

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

// msgpack visitor which makes jsi objects
// struct jsi_visitor : msgpack::v2::null_visitor {
//   jsi_visitor(Runtime &runtime) : m_r(runtime), m_root(runtime, 0) {}
//   // std::vector<Value *> m_stack;
//   Array m_root;
//   Runtime &m_r;
//   Array *m_curArr;
//   Object *m_curObj;

//   bool visit_nil() {
//     //    m_s += "null";
//     return true;
//   }
//   bool visit_boolean(bool v) {
//     if (v) {
//       //      m_s += "true";
//     } else {
//       //      m_s += "false";
//     }
//     return true;
//   }
//   bool visit_positive_integer(uint64_t v) {
//     //    std::stringstream ss;
//     //    ss << v;
//     //    m_s += ss.str();
//     return true;
//   }
//   bool visit_negative_integer(int64_t v) {
//     //    std::stringstream ss;
//     //    ss << v;
//     //    m_s += ss.str();
//     return true;
//   }
//   bool visit_str(const char *v, uint32_t size) {
//     //    m_s += '"' + std::string(v, size) + '"';
//     return true;
//   }
//   // array
//   bool start_array(uint32_t num_elements) {
//     // in array
//     // if (m_curArr) {

//     // } else if (m_curObj) {

//     // }
//     // if (m_stack.empty()) {
//     //     return true; // nothing
//     // }
//     // auto arr = Array(runtime, num_elements);
//     // auto par = m_stack.back()
//     //   // m_stack.push_back(&m_root);
//     // } else {
//     //   // TODO
//     //   // if (par.type === )
//     // }
//     //    m_s += "[";
//     return true;
//   }
//   bool start_array_item() { return true; }
//   bool end_array_item() {
//     // m_stack.pop();
//     //    m_s += ",";
//     return true;
//   }
//   bool end_array() {
//     //    m_s.erase(m_s.size() - 1, 1); // remove the last ','
//     //    m_s += "]";
//     return true;
//   }

//   // map
//   bool start_map(uint32_t /*num_kv_pairs*/) {
//     //    m_s += "{";
//     return true;
//   }
//   bool end_map_key() {
//     //    m_s += ":";
//     return true;
//   }
//   bool end_map_value() {
//     //    m_s += ",";
//     return true;
//   }
//   bool end_map() {
//     //    m_s.erase(m_s.size() - 1, 1); // remove the last ','
//     //    m_s += "}";
//     return true;
//   }
//   void parse_error(size_t /*parsed_offset*/, size_t /*error_offset*/) {
//     // report error.
//   }
//   void insufficient_bytes(size_t /*parsed_offset*/, size_t /*error_offset*/)
//   {
//     // report error.
//   }
// };

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
    // TODO
    return jsi::String::createFromUtf8(runtime, "TODO ext");
  case msgpack::type::MAP: {
    jsi::Object obj = jsi::Object(runtime);
    auto *p = o.via.map.ptr;
    auto *const pend = o.via.map.ptr + o.via.map.size;
    for (; p < pend; ++p) {
      auto key = p->key.as<std::string>();
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
  Function rpcOnJs = runtime.global().getPropertyAsFunction(runtime, "rpcOnJs");
  Function arrayBufferCtor =
      runtime.global().getPropertyAsFunction(runtime, "ArrayBuffer");
  Value v = arrayBufferCtor.callAsConstructor(runtime, size);
  Object o = v.getObject(runtime);
  ArrayBuffer buf = o.getArrayBuffer(runtime);
  std::memcpy(buf.data(runtime), data.get(), size);

  // auto jsstart = std::chrono::high_resolution_clock::now();
  rpcOnJs.call(runtime, move(v), 1);
  // auto jsfinish = std::chrono::high_resolution_clock::now();
  // double jsdiff =
  //     std::chrono::duration_cast<std::chrono::milliseconds>(jsfinish -
  //     jsstart)
  //         .count();

  auto dataPtr = (const char *)data.get();
  double cppdiff;

  // TEMP
  // TODO buffer locally or get the whole thing?
  try {

    auto cppstart = std::chrono::high_resolution_clock::now();
    size_t offset = 0;
    msgpack::object_handle oh = msgpack::unpack(dataPtr, size, offset);
    msgpack::object obj = oh.get();
    auto payloadLen = obj.as<size_t>();

    // visitor
    // {

    //   jsi_visitor vis(runtime);
    //   bool ret = msgpack::parse(dataPtr, size, offset, vis);
    //   printf("aaa %s\n", temp.c_str());

    Function rpcOnJs2 =
        runtime.global().getPropertyAsFunction(runtime, "rpcOnJs2");

    //   // v.setProperty(runtime, jsi::String::createFromUtf8(runtime,
    //   "tempkey"),
    //   //             jsi::String::createFromUtf8(runtime, "tempval"));
    //   rpcOnJs2.call(runtime, move(arr), 1);
    // }

    // decode rpc payload
    {
      msgpack::object_handle oh2 = msgpack::unpack(dataPtr, size, offset);
      auto obj2 = oh2.get();
      Value v = convertMPToJSI(runtime, obj2);
      Function rpcOnJs2 =
          runtime.global().getPropertyAsFunction(runtime, "rpcOnJs2");
      rpcOnJs2.call(runtime, move(v), 1);
      // std::stringstream s;
      // s << obj2 << std::endl;
      // auto temp = s.str();
      // printf("aaa %s\n", temp.c_str());
    }
    // auto cppfinish = std::chrono::high_resolution_clock::now();
    // cppdiff = std::chrono::duration_cast<std::chrono::milliseconds>(cppfinish
    // -
    //                                                                 cppstart)
    //               .count();
  } catch (const std::exception &err) {
    printf("aaa error");
  } catch (...) {
    printf("aaa error");
    // TEMP
  }

  // printf("aaa %f %g\n", jsdiff, cppdiff);
}
