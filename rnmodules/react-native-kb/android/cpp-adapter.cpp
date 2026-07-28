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
      // NewByteArray leaves OutOfMemoryError pending. Returning with it still
      // set means the JS thread makes its next JNI call with a live exception
      // -- UB, and an abort under CheckJNI. Describe it to logcat before
      // clearing, and route a line through onLog so an OOM here also reaches
      // the uploadable log, not just logcat.
      env->ExceptionDescribe();
      env->ExceptionClear();
      // onLog itself allocates a jstring (jni::make_jstring); if that
      // allocation throws -- plausible right after an OOM -- an fbjni
      // JniException must not escape writeToGo in place of the documented
      // `return false`, or the caller's exception-handling contract breaks.
      try {
        onLog("writeToGo: NewByteArray failed (out of memory), dropping message");
      } catch (...) {
        env->ExceptionClear();
      }
      return false;
    }
    // Adopt into a local_ref so the ref is released even if the call below
    // throws a JniException.
    auto arr = jni::adopt_local(static_cast<jni::JArrayByte::javaobject>(jba));
    env->SetByteArrayRegion(jba, 0, size, (jbyte *)ptr);
    static auto method =
        JKbModule::javaClassStatic()
            ->getMethod<jboolean(jni::alias_ref<jni::JArrayByte>)>("rpcOnGo");
    auto ok = method(jModule_, arr);
    return ok != JNI_FALSE;
  }

  void onFatal(int64_t epoch) {
    jni::ThreadScope scope;
    static auto method =
        JKbModule::javaClassStatic()->getMethod<void(jlong)>(
            "onRpcStreamFatal");
    method(jModule_, static_cast<jlong>(epoch));
  }

  // Called from JNI. Routes native bridge errors into the uploadable log --
  // __android_log_print only reaches logcat, which a field log send does not
  // include.
  void onLog(const std::string &message) {
    jni::ThreadScope scope;
    static auto method =
        JKbModule::javaClassStatic()
            ->getMethod<void(jni::alias_ref<jni::JString>)>("onNativeLog");
    method(jModule_, jni::make_jstring(message));
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
// A stale invalidate can run after the next module already installed its own
// bridge -- RN's module teardown is not ordered against the next module's
// installJSIBindings/getBindingsInstaller, so without an identity check an
// unconditional clear would tear down the LIVE bridge with no desync and no
// recovery. Mirrors iOS's kbClearBridgeIfCurrent: only clear if the module
// invoking invalidate is still the one that installed the current
// adapter/bridge.
//
// Returns true only when it actually matched `thiz` and cleared, so the Kotlin
// caller can gate Keybase.reset() on it exactly like iOS gates KeybaseReset on
// kbClearBridgeIfCurrent. The gate is the whole point: a stale invalidate that
// reset the Go connection would tear down the loopback the NEXT module already
// owns, killing its in-flight RPCs for no reason.
static jboolean nativeInvalidate(jni::alias_ref<JKbModule::javaobject> thiz) {
  std::shared_ptr<kb::KBBridge> oldBridge;
  std::shared_ptr<KbNativeAdapter> oldAdapter;
  {
    std::lock_guard<std::mutex> lock(g_mutex);
    if (!g_adapter || !(g_adapter->jModule_ == thiz)) {
      return JNI_FALSE;
    }
    oldBridge = std::move(g_bridge);
    oldAdapter = std::move(g_adapter);
    g_bridge = nullptr;
    g_adapter = nullptr;
  }
  if (oldBridge) {
    oldBridge->markTornDown();
  }
  return JNI_TRUE;
}

static void nativeResetRecv(jni::alias_ref<JKbModule::javaobject>) {
  if (auto bridge = getBridge()) {
    bridge->resetRecv();
  }
}

static jni::local_ref<BindingsInstallerHolder::javaobject>
getBindingsInstaller(jni::alias_ref<JKbModule::javaobject> thiz) {
  auto adapter = std::make_shared<KbNativeAdapter>(thiz);
  // INVARIANT: g_adapter and g_bridge are only ever published as a PAIR, and
  // g_bridge is only ever published while its own adapter is still current.
  // Publishing the adapter here without also dropping the previous module's
  // bridge would leave that bridge live with no owner -- a later
  // nativeInvalidate from the previous module no longer matches g_adapter, so
  // nothing would ever tear it down. A new module installing means the
  // previous one is definitively dead, so take its bridge over now.
  std::shared_ptr<kb::KBBridge> displaced;
  {
    std::lock_guard<std::mutex> lock(g_mutex);
    displaced = std::move(g_bridge);
    g_bridge = nullptr;
    g_adapter = adapter;
  }
  // Outside the lock: markTornDown only flips an atomic, but nothing that can
  // reenter this file may run while g_mutex is held.
  if (displaced) {
    displaced->markTornDown();
  }

  // Captured strongly: the adapter must outlive the bridge that calls it.
  // Unpublishing a bridge only flips its teardown flag -- another thread can
  // still be inside one of these callbacks -- so the adapter cannot be kept
  // alive by the g_adapter slot alone. No cycle: the adapter holds a
  // global_ref to the Java module and never the bridge.
  return BindingsInstallerHolder::newObjectCxxArgs(
      [adapter](
          jsi::Runtime &runtime,
          const std::shared_ptr<CallInvoker> &callInvoker) {
        auto bridge = std::make_shared<kb::KBBridge>();
        bridge->install(
            runtime, callInvoker,
            // false means the RPC never reached Go, so the caller fails that
            // invocation instead of waiting forever for a reply.
            [adapter](void *ptr, size_t size) -> bool {
              return adapter->writeToGo(ptr, size);
            },
            [adapter](const std::string &err) {
              __android_log_print(ANDROID_LOG_ERROR, "KBBridge",
                                  "JSI error: %s", err.c_str());
              adapter->onLog("jsi error: " + err);
            },
            // The incoming stream desynced; reset the Go connection (if
            // `epoch` -- the connection the desynced bytes actually came
            // from -- is still current) and tell JS so it fails outstanding
            // RPCs rather than hanging forever.
            [adapter](int64_t epoch) {
              __android_log_print(ANDROID_LOG_ERROR, "KBBridge",
                                  "rpc stream desync, resetting connection");
              adapter->onLog("rpc stream desync, resetting connection");
              adapter->onFatal(epoch);
            });

        // Identity-gated publish: this bridge belongs to `adapter`, so it may
        // only be published while `adapter` is still the current one. Without
        // the gate, a nativeInvalidate that lands between the g_adapter store
        // above and this lambda (RN runs them at different times, on
        // different threads) clears both slots and then this store resurrects
        // g_bridge -- targeting a runtime that is going away, with a null
        // g_adapter. A bridge installed into a runtime whose module was
        // already invalidated must be inert, not published.
        std::shared_ptr<kb::KBBridge> old;
        bool published = false;
        {
          std::lock_guard<std::mutex> lock(g_mutex);
          if (g_adapter == adapter) {
            old = std::move(g_bridge);
            g_bridge = bridge;
            published = true;
          }
        }
        // Only flips an atomic. The old bridge's jsi handles belong to its
        // own runtime and are released by its kbTeardown host object. Kept
        // outside the lock -- nothing may reenter this file under g_mutex.
        if (old) {
          old->markTornDown();
        }
        if (!published) {
          bridge->markTornDown();
        }
      });
}

static void nativeOnDataFromGo(jni::alias_ref<JKbModule::javaobject> thiz,
                                jni::alias_ref<jni::JArrayByte> data,
                                jlong epoch) {
  auto bridge = getBridge();
  if (!bridge || !data)
    return;
  auto pinned = data->pin();
  bridge->onDataFromGo(reinterpret_cast<uint8_t *>(pinned.get()),
                       pinned.size(), static_cast<int64_t>(epoch));
}

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *vm, void *) {
  return jni::initialize(vm, [] {
    jni::findClassStatic("com/reactnativekb/KbModule")
        ->registerNatives({
            makeNativeMethod("getBindingsInstaller", getBindingsInstaller),
            makeNativeMethod("nativeOnDataFromGo", nativeOnDataFromGo),
            makeNativeMethod("nativeInvalidate", nativeInvalidate),
            makeNativeMethod("nativeResetRecv", nativeResetRecv),
        });
  });
}
