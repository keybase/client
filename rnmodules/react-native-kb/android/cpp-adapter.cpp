#include "react-native-kb.h"
#include <ReactCommon/BindingsInstallerHolder.h>
#include <ReactCommon/CallInvoker.h>
#include <android/log.h>
#include <fbjni/fbjni.h>
#include <jsi/jsi.h>

using namespace facebook;
using namespace facebook::jsi;
using namespace facebook::react;

struct JKbModule : jni::JavaClass<JKbModule> {
  static constexpr auto kJavaDescriptor = "Lcom/reactnativekb/KbModule;";
};

class KbNativeAdapter {
public:
  jni::global_ref<JKbModule::javaobject> jModule_;
  std::shared_ptr<kb::KBBridge> bridge_;

  explicit KbNativeAdapter(jni::alias_ref<JKbModule::javaobject> jModule)
      : jModule_(jni::make_global(jModule)) {}

  void writeToGo(void *ptr, size_t size) {
    jni::ThreadScope scope;
    auto env = jni::Environment::current();
    auto jba = env->NewByteArray(size);
    env->SetByteArrayRegion(jba, 0, size, (jbyte *)ptr);
    static auto method =
        JKbModule::javaClassStatic()
            ->getMethod<void(jni::alias_ref<jni::JArrayByte>)>("rpcOnGo");
    method(jModule_, jni::wrap_alias(jba));
    env->DeleteLocalRef(jba);
  }
};

static std::shared_ptr<KbNativeAdapter> g_adapter;

static jni::local_ref<BindingsInstallerHolder::javaobject>
getBindingsInstaller(jni::alias_ref<JKbModule::javaobject> thiz) {
  g_adapter = std::make_shared<KbNativeAdapter>(thiz);

  return BindingsInstallerHolder::newObjectCxxArgs(
      [adapter = g_adapter](jsi::Runtime &runtime,
                            const std::shared_ptr<CallInvoker> &callInvoker) {
        if (adapter->bridge_) {
          adapter->bridge_->teardown();
        }
        adapter->bridge_ = std::make_shared<kb::KBBridge>();
        adapter->bridge_->install(
            runtime, callInvoker,
            [weak = std::weak_ptr(adapter)](void *ptr, size_t size) {
              if (auto a = weak.lock())
                a->writeToGo(ptr, size);
            },
            [](const std::string &err) {
              __android_log_print(ANDROID_LOG_ERROR, "KBBridge",
                                  "JSI error: %s", err.c_str());
            });
      });
}

static void nativeOnDataFromGo(jni::alias_ref<JKbModule::javaobject> thiz,
                                jni::alias_ref<jni::JArrayByte> data) {
  auto adapter = g_adapter;
  if (!adapter || !adapter->bridge_ || !data)
    return;
  auto pinned = data->pin();
  adapter->bridge_->onDataFromGo(reinterpret_cast<uint8_t *>(pinned.get()),
                                  pinned.size());
}

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *vm, void *) {
  return jni::initialize(vm, [] {
    jni::findClassStatic("com/reactnativekb/KbModule")
        ->registerNatives({
            makeNativeMethod("getBindingsInstaller", getBindingsInstaller),
            makeNativeMethod("nativeOnDataFromGo", nativeOnDataFromGo),
        });
  });
}
