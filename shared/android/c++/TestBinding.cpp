#include "TestBinding.h"

#include <dlfcn.h>
// #include <forandroid.h>
#include <android/log.h>
#include <android/trace.h>
#include <jsi/JSIDynamic.h>
#include <chrono>  // std::chrono::seconds
#include <thread>

// #ifndef __ANDROID_API__
// #define __ANDROID_API__ 29
// #endif

#define APPNAME "MyApp"

struct EventHandlerWrapper {
  EventHandlerWrapper(jsi::Function eventHandler)
      : callback(std::move(eventHandler)) {}

  jsi::Function callback;
};

#if ANDROID
extern "C" {
JNIEXPORT void JNICALL Java_io_keybase_ossifrage_MainActivity_install(
    JNIEnv *env, jobject thiz, jlong runtimePtr) {
  auto testBinding = std::make_shared<example::TestBinding>();
  jsi::Runtime *runtime = (jsi::Runtime *)runtimePtr;

  example::TestBinding::install(*runtime, testBinding);
}
}
#endif

namespace example {

void TestBinding::install(jsi::Runtime &runtime,
                          std::shared_ptr<TestBinding> testBinding) {
  auto testModuleName = "nativeTest";
  auto object = jsi::Object::createFromHostObject(runtime, testBinding);
  runtime.global().setProperty(runtime, testModuleName, std::move(object));
}

TestBinding::TestBinding() {}

jsi::Value TestBinding::get(jsi::Runtime &runtime,
                            const jsi::PropNameID &name) {
  auto methodName = name.utf8(runtime);

  if (methodName == "traceBeginSection") {
    return jsi::Function::createFromHostFunction(
        runtime, name, 2,
        [](jsi::Runtime &runtime, const jsi::Value &thisValue,
           const jsi::Value *arguments, size_t count) -> jsi::Value {
          auto name = arguments[0].toString(runtime).utf8(runtime);
          ATrace_beginSection(name.c_str());
          return 0;
        });
  }

  if (methodName == "traceEndSection") {
    return jsi::Function::createFromHostFunction(
        runtime, name, 0,
        [](jsi::Runtime &runtime, const jsi::Value &thisValue,
           const jsi::Value *arguments, size_t count) -> jsi::Value {
          ATrace_endSection();
          return 0;
        });
  }

  if (methodName == "runTest") {
    __android_log_print(ANDROID_LOG_VERBOSE, APPNAME,
                        "!!!!!! HI FROM NATIVE CODE %d", __ANDROID_API__);
    return jsi::Function::createFromHostFunction(
        runtime, name, 0,
        [](jsi::Runtime &runtime, const jsi::Value &thisValue,
           const jsi::Value *arguments,
           size_t count) -> jsi::Value { return 0; });
  }

  return jsi::Value::undefined();
}

}  // namespace example
