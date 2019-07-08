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
#if ANDROID
#include <android/log.h>
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
        [](jsi::Runtime &runtime, const jsi::Value &thisValue,
           const jsi::Value *arguments, size_t count) -> jsi::Value {
          auto fn = arguments[0].getObject(runtime).asFunction(runtime);
          auto eventhandler =
              std::make_shared<EventHandlerWrapper>(std::move(fn));
          std::thread t([eventhandler, &runtime]() {
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
            while (true) {
              // __android_log_print(ANDROID_LOG_INFO, "GOJSI", "starting
              // read");
              auto result = ReadB64ForC();
              auto b64data = result.r0;
              // __android_log_print(ANDROID_LOG_INFO, "GOJSI",
              //                     "from read: err %s", result.r1);
              try {
                auto jsi_string =
                    jsi::String::createFromAscii(runtime, b64data);
                eventhandler->callback.call(runtime, jsi_string);
              } catch (...) {
                __android_log_print(ANDROID_LOG_INFO, "GOJSI",
                                    "Failed to call callback. Dev Reload?");
                break;
              }
            }
          });
          t.detach();
          return jsi::Value::undefined();
        });
  }

  return jsi::Value::undefined();
}

}  // namespace keybase
