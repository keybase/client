#include "react-native-kb.h"
#include <ReactCommon/BindingsInstallerHolder.h>
#include <ReactCommon/CallInvoker.h>
#include <android/log.h>
#include <fbjni/fbjni.h>
#include <jsi/jsi.h>
#include <memory>
#include <mutex>

using namespace facebook;
using namespace facebook::jsi;
using namespace facebook::react;

struct JKbModule : jni::JavaClass<JKbModule> {
  static constexpr auto kJavaDescriptor = "Lcom/reactnativekb/KbModule;";
};

class KbNativeAdapter {
public:
  jni::global_ref<JKbModule::javaobject> jModule_;

  explicit KbNativeAdapter(jni::alias_ref<JKbModule::javaobject> jModule)
      : jModule_(jni::make_global(jModule)) {}

  bool writeToGo(void *ptr, size_t size) {
    jni::ThreadScope scope;
    auto env = jni::Environment::current();
    auto jba = env->NewByteArray(size);
    if (jba == nullptr) {
      return false;
    }
    env->SetByteArrayRegion(jba, 0, size, (jbyte *)ptr);
    static auto method =
        JKbModule::javaClassStatic()
            ->getMethod<jboolean(jni::alias_ref<jni::JArrayByte>)>("rpcOnGo");
    auto ok = method(jModule_, jni::wrap_alias(jba));
    env->DeleteLocalRef(jba);
    return ok != JNI_FALSE;
  }

  void onFatal() {
    jni::ThreadScope scope;
    static auto method =
        JKbModule::javaClassStatic()->getMethod<void()>("onRpcStreamFatal");
    method(jModule_);
  }
};

// The bridge is created on the JS thread and consumed by the native reader
// thread, so both the adapter and the bridge live behind this lock.
static std::mutex g_mutex;
static std::shared_ptr<KbNativeAdapter> g_adapter;
static std::shared_ptr<kb::KBBridge> g_bridge;

static std::shared_ptr<kb::KBBridge> getBridge() {
  std::lock_guard<std::mutex> lock(g_mutex);
  return g_bridge;
}

// Any thread. Drops this module's C++-side state: flips the bridge's atomic
// teardown flag so the permanent reader stops delivering into a runtime that
// is going away, and releases the globals that would otherwise pin a dead
// KbModule (and its ReactContext/Activity) and a destroyed runtime's
// CallInvoker for the life of the process.
//
// Only atomics and shared_ptr slots are touched — the old bridge's jsi
// handles belong to its own runtime and are released by its kbTeardown host
// object on the JS thread.
static void nativeInvalidate(jni::alias_ref<JKbModule::javaobject>) {
  std::shared_ptr<kb::KBBridge> oldBridge;
  std::shared_ptr<KbNativeAdapter> oldAdapter;
  {
    std::lock_guard<std::mutex> lock(g_mutex);
    oldBridge = std::move(g_bridge);
    oldAdapter = std::move(g_adapter);
    g_bridge = nullptr;
    g_adapter = nullptr;
  }
  if (oldBridge) {
    oldBridge->markTornDown();
  }
}

static jni::local_ref<BindingsInstallerHolder::javaobject>
getBindingsInstaller(jni::alias_ref<JKbModule::javaobject> thiz) {
  auto adapter = std::make_shared<KbNativeAdapter>(thiz);
  {
    std::lock_guard<std::mutex> lock(g_mutex);
    g_adapter = adapter;
  }

  return BindingsInstallerHolder::newObjectCxxArgs(
      [weakAdapter = std::weak_ptr<KbNativeAdapter>(adapter)](
          jsi::Runtime &runtime,
          const std::shared_ptr<CallInvoker> &callInvoker) {
        auto bridge = std::make_shared<kb::KBBridge>();
        bridge->install(
            runtime, callInvoker,
            // false means the RPC never reached Go, so the caller fails that
            // invocation instead of waiting forever for a reply.
            [weakAdapter](void *ptr, size_t size) -> bool {
              if (auto a = weakAdapter.lock()) {
                return a->writeToGo(ptr, size);
              }
              return false;
            },
            [](const std::string &err) {
              __android_log_print(ANDROID_LOG_ERROR, "KBBridge",
                                  "JSI error: %s", err.c_str());
            },
            // The incoming stream desynced; reset the Go connection and tell
            // JS so it fails outstanding RPCs rather than hanging forever.
            [weakAdapter]() {
              __android_log_print(ANDROID_LOG_ERROR, "KBBridge",
                                  "rpc stream desync, resetting connection");
              if (auto a = weakAdapter.lock()) {
                a->onFatal();
              }
            });

        std::shared_ptr<kb::KBBridge> old;
        {
          std::lock_guard<std::mutex> lock(g_mutex);
          old = std::move(g_bridge);
          g_bridge = bridge;
        }
        // Only flips an atomic. The old bridge's jsi handles belong to its
        // own runtime and are released by its kbTeardown host object.
        if (old) {
          old->markTornDown();
        }
      });
}

static void nativeOnDataFromGo(jni::alias_ref<JKbModule::javaobject> thiz,
                                jni::alias_ref<jni::JArrayByte> data) {
  auto bridge = getBridge();
  if (!bridge || !data)
    return;
  auto pinned = data->pin();
  bridge->onDataFromGo(reinterpret_cast<uint8_t *>(pinned.get()),
                       pinned.size());
}

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *vm, void *) {
  return jni::initialize(vm, [] {
    jni::findClassStatic("com/reactnativekb/KbModule")
        ->registerNatives({
            makeNativeMethod("getBindingsInstaller", getBindingsInstaller),
            makeNativeMethod("nativeOnDataFromGo", nativeOnDataFromGo),
            makeNativeMethod("nativeInvalidate", nativeInvalidate),
        });
  });
}
