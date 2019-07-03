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
JNIEXPORT void JNICALL Java_com_testmodule_MainActivity_install(
    JNIEnv *env, jobject thiz, jlong runtimePtr) {
  auto testBinding = std::make_shared<keybase::TestBinding>();
  jsi::Runtime *runtime = (jsi::Runtime *)runtimePtr;

  keybase::TestBinding::install(*runtime, testBinding);
}
}
#endif

namespace keybase {

void TestBinding::install(jsi::Runtime &runtime,
                          std::shared_ptr<TestBinding> testBinding) {
  auto testModuleName = "keybaseJSI";
  auto object = jsi::Object::createFromHostObject(runtime, testBinding);
  runtime.global().setProperty(runtime, testModuleName, std::move(object));
}

TestBinding::TestBinding() {}

jsi::Value TestBinding::get(jsi::Runtime &runtime,
                            const jsi::PropNameID &name) {
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
