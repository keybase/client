#include "Binding.h"

#include <dlfcn.h>
// #include <forandroid.h>
#include <android/log.h>
#include <android/trace.h>
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
  auto binding = std::make_shared<example::Binding>();
  jsi::Runtime *runtime = (jsi::Runtime *)runtimePtr;

  example::Binding::install(*runtime, binding);
}
}
#endif

namespace example {

void Binding::install(jsi::Runtime &runtime, std::shared_ptr<Binding> binding) {
  auto testModuleName = "nativeTest";
  auto object = jsi::Object::createFromHostObject(runtime, binding);
  runtime.global().setProperty(runtime, testModuleName, std::move(object));
}

Binding::Binding() {}

jsi::Value Binding::get(jsi::Runtime &runtime, const jsi::PropNameID &name) {
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

  if (methodName == "traceBeginAsyncSection") {
    return jsi::Function::createFromHostFunction(
        runtime, name, 2,
        [](jsi::Runtime &runtime, const jsi::Value &thisValue,
           const jsi::Value *arguments, size_t count) -> jsi::Value {
          auto name = arguments[0].toString(runtime).utf8(runtime);
          int cookie = (int)arguments[1].asNumber();
          ATrace_beginAsyncSection(name.c_str(), cookie);
          return 0;
        });
  }

  if (methodName == "traceEndAsyncSection") {
    return jsi::Function::createFromHostFunction(
        runtime, name, 0,
        [](jsi::Runtime &runtime, const jsi::Value &thisValue,
           const jsi::Value *arguments, size_t count) -> jsi::Value {
          auto name = arguments[0].toString(runtime).utf8(runtime);
          int cookie = (int)arguments[1].asNumber();
          ATrace_endAsyncSection(name.c_str(), cookie);
          return 0;
        });
  }

  if (methodName == "timeMarker") {
    return jsi::Function::createFromHostFunction(
        runtime, name, 0,
        [](jsi::Runtime &runtime, const jsi::Value &thisValue,
           const jsi::Value *arguments, size_t count) -> jsi::Value {
          auto label = arguments[0].toString(runtime).utf8(runtime);
          std::chrono::milliseconds ms =
              std::chrono::duration_cast<std::chrono::milliseconds>(
                  std::chrono::system_clock::now().time_since_epoch());
          __android_log_print(ANDROID_LOG_DEBUG, "Time Marker", "%s: %s",
                              label.c_str(),
                              std::to_string(ms.count()).c_str());
          return 0;
        });
  }

  if (methodName == "testNum") {
    return jsi::Function::createFromHostFunction(
        runtime, name, 0,
        [](jsi::Runtime &runtime, const jsi::Value &thisValue,
           const jsi::Value *arguments,
           size_t count) -> jsi::Value { return 123; });
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
