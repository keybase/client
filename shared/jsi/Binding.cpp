#include "Binding.h"

#include <dlfcn.h>
#include <chrono>  // std::chrono::seconds
#include <thread>
#if __i386__
#include <keybaselib-386.h>
#elif __arm__
#include <keybaselib-arm.h>
#else
#include <keybaselib-arm64.h>
#endif
#if ANDROID
#include <android/log.h>
#endif

struct EventHandlerWrapper {
  EventHandlerWrapper(jsi::Function eventHandler)
      : callback(std::move(eventHandler)) {}

  jsi::Function callback;
};

extern "C" {
JNIEXPORT void JNICALL Java_io_keybase_ossifrage_MainActivity_install(
    JNIEnv *env, jobject thiz, jlong runtimePtr) {
  auto binding = std::make_shared<keybase::Binding>();
  keybase::currentBinding = binding;

  jsi::Runtime *runtime = (jsi::Runtime *)runtimePtr;
  keybase::Binding::install(*runtime, binding);
}

JNIEXPORT void JNICALL
Java_io_keybase_ossifrage_modules_KeybaseEngine_forwardEngineData(
    JNIEnv *env, jobject thiz, jlong runtimePtr, jstring engineData) {
  jsi::Runtime *runtime = (jsi::Runtime *)runtimePtr;
  const char *nativeString = env->GetStringUTFChars(engineData, 0);
  auto jsi_string = jsi::String::createFromAscii(*runtime, nativeString);
  if (keybase::currentBinding->engineCallback_) {
    keybase::currentBinding->engineCallback_->call(*runtime, jsi_string);
  }
  env->ReleaseStringUTFChars(engineData, nativeString);
}
}

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

  if (methodName == "runWithData") {
    return jsi::Function::createFromHostFunction(
        runtime, name, 1,
        [](jsi::Runtime &runtime, const jsi::Value &thisValue,
           const jsi::Value *arguments, size_t count) -> jsi::Value {
          auto b64Data = arguments[0].asString(runtime).utf8(runtime);
          auto c_str = b64Data.c_str();
          auto err = WriteB64FromC((char *)c_str);
          // __android_log_print(ANDROID_LOG_INFO, "GOJSI", "I wrote it. err:
          // %s",
          //                     err);
          return jsi::Value::undefined();
        });
  }

  if (methodName == "addListener") {
    return jsi::Function::createFromHostFunction(
        runtime, name, 1,
        [this](jsi::Runtime &runtime, const jsi::Value &thisValue,
               const jsi::Value *arguments, size_t count) -> jsi::Value {
          auto fn = arguments[0].getObject(runtime).asFunction(runtime);
          engineCallback_ = std::make_unique<jsi::Function>(std::move(fn));
          return jsi::Value::undefined();
        });
  }

  return jsi::Value::undefined();
}

}  // namespace keybase
