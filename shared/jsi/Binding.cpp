#include "Binding.h"

#include <dlfcn.h>
#include <jsi/JSIDynamic.h>
#include <chrono>  // std::chrono::seconds
#include <thread>
#if __i386__
#include <keybaselib-386.h>
#elif __arm__
#include <keybaselib-arm.h>
#else
#include <keybaselib-arm64.h>
#endif

struct EventHandlerWrapper {
  EventHandlerWrapper(jsi::Function eventHandler)
      : callback(std::move(eventHandler)) {}

  jsi::Function callback;
};

#if ANDROID
extern "C" {
JNIEXPORT void JNICALL Java_io_keybase_ossifrage_MainActivity_install(
    JNIEnv *env, jobject thiz, jlong runtimePtr) {
  auto binding = std::make_shared<keybase::Binding>();
  jsi::Runtime *runtime = (jsi::Runtime *)runtimePtr;

  keybase::Binding::install(*runtime, binding);
}
}
#endif

namespace keybase {

void Binding::install(jsi::Runtime &runtime, std::shared_ptr<Binding> binding) {
  auto JSIModuleName = "keybaseJSI";
  auto object = jsi::Object::createFromHostObject(runtime, binding);
  runtime.global().setProperty(runtime, JSIModuleName, std::move(object));
}

Binding::Binding() {}

jsi::Value Binding::get(jsi::Runtime &runtime, const jsi::PropNameID &name) {
  auto methodName = name.utf8(runtime);

  if (methodName == "testNum") {
    return jsi::Function::createFromHostFunction(
        runtime, name, 0,
        [](jsi::Runtime &runtime, const jsi::Value &thisValue,
           const jsi::Value *arguments,
           size_t count) -> jsi::Value { return 123; });
  }

  return jsi::Value::undefined();
}

}  // namespace keybase
