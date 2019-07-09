#pragma once

#include <jsi/jsi.h>
#include <deque>
#include <mutex>

#include <jni.h>

using namespace facebook;

extern "C" {
JNIEXPORT void JNICALL Java_io_keybase_ossifrage_MainActivity_install(
    JNIEnv *env, jobject thiz, jlong runtimePtr);
JNIEXPORT void JNICALL
Java_io_keybase_ossifrage_modules_KeybaseEngine_forwardEngineData(
    JNIEnv *env, jobject thiz, jlong runtimePtr, jstring engineData);
}

namespace keybase {

/*
 * Exposes to JavaScript realm.
 */
class Binding : public jsi::HostObject {
 public:
  /*
   * Installs Binding into JavaSctipt runtime.
   * Thread synchronization must be enforced externally.
   */
  static void install(jsi::Runtime &runtime, std::shared_ptr<Binding> binding);

  Binding();

  /*
   * `jsi::HostObject` specific overloads.
   */
  jsi::Value get(jsi::Runtime &runtime, const jsi::PropNameID &name) override;
  std::unique_ptr<jsi::Function> engineCallback_;
};

std::shared_ptr<Binding> currentBinding;

}  // namespace keybase
