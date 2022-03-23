#include "rpc.h"

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

void RpcOnJS(Runtime &runtime, std::shared_ptr<uint8_t> data, int size) {
  Function rpcOnJs = runtime.global().getPropertyAsFunction(runtime, "rpcOnJs");
  Function arrayBufferCtor =
      runtime.global().getPropertyAsFunction(runtime, "ArrayBuffer");
  Value v = arrayBufferCtor.callAsConstructor(runtime, size);
  Object o = v.getObject(runtime);
  ArrayBuffer buf = o.getArrayBuffer(runtime);
  std::memcpy(buf.data(runtime), data.get(), size);
  rpcOnJs.call(runtime, move(v), 1);
}
