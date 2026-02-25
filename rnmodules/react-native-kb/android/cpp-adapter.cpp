#include "react-native-kb.h"
#include <ReactCommon/BindingsInstallerHolder.h>
#include <ReactCommon/CallInvoker.h>
#include <android/log.h>
#include <fbjni/fbjni.h>
#include <jni.h>
#include <jsi/jsi.h>
#include <pthread.h>
#include <sys/types.h>

using namespace facebook;
using namespace facebook::jsi;
using namespace facebook::react;

static std::shared_ptr<kb::KBBridge> g_bridge;
static JavaVM *java_vm = nullptr;
static jobject java_object = nullptr;
static jclass g_kbClass = nullptr;
static jmethodID g_rpcOnGoMethod = nullptr;

/**
 * A simple callback function that allows us to detach current JNI Environment
 * when the thread is destroyed.
 * See https://stackoverflow.com/a/30026231 for detailed explanation
 */
void DeferThreadDetach(JNIEnv *env) {
  static pthread_key_t thread_key;

  static auto run_once = [] {
    const auto err = pthread_key_create(&thread_key, [](void *ts_env) {
      if (ts_env) {
        java_vm->DetachCurrentThread();
      }
    });
    if (err) {
    }
    return 0;
  }();
  static_cast<void>(run_once);

  const auto ts_env = pthread_getspecific(thread_key);
  if (!ts_env) {
    if (pthread_setspecific(thread_key, env)) {
    }
  }
}

/**
 * Get a JNIEnv* valid for this thread, regardless of whether
 * we're on a native thread or a Java thread.
 * See https://stackoverflow.com/a/30026231 for detailed explanation
 */
JNIEnv *GetJniEnv() {
  JNIEnv *env = nullptr;
  auto get_env_result = java_vm->GetEnv((void **)&env, JNI_VERSION_1_6);
  if (get_env_result == JNI_EDETACHED) {
    if (java_vm->AttachCurrentThread(&env, nullptr) == JNI_OK) {
      DeferThreadDetach(env);
    }
  }
  return env;
}

static void cacheJNIMethods(JNIEnv *env) {
  if (!g_kbClass && java_object) {
    jclass cls = env->GetObjectClass(java_object);
    g_kbClass = (jclass)env->NewGlobalRef(cls);
    g_rpcOnGoMethod = env->GetMethodID(g_kbClass, "rpcOnGo", "([B)V");
    env->DeleteLocalRef(cls);
  }
}

static jni::local_ref<BindingsInstallerHolder::javaobject>
getBindingsInstaller(jni::alias_ref<jni::JObject> thiz) {
  JNIEnv *env = jni::Environment::current();
  env->GetJavaVM(&java_vm);
  if (java_object) {
    env->DeleteGlobalRef(java_object);
  }
  java_object = env->NewGlobalRef(thiz.get());
  cacheJNIMethods(env);

  return BindingsInstallerHolder::newObjectCxxArgs(
      [](jsi::Runtime &runtime,
         const std::shared_ptr<CallInvoker> &callInvoker) {
        if (g_bridge) {
          g_bridge->teardown();
        }
        g_bridge = std::make_shared<kb::KBBridge>();
        g_bridge->install(
            runtime, callInvoker,
            // writeToGo: called from JS thread when rpcOnGo fires
            [](void *ptr, size_t size) {
              JNIEnv *jniEnv = GetJniEnv();
              if (!jniEnv || !java_object || !g_rpcOnGoMethod)
                return;
              jbyteArray jba = jniEnv->NewByteArray(size);
              jniEnv->SetByteArrayRegion(jba, 0, size, (jbyte *)ptr);
              jniEnv->CallVoidMethod(java_object, g_rpcOnGoMethod, jba);
              jniEnv->DeleteLocalRef(jba);
            },
            // onError
            [](const std::string &err) {
              __android_log_print(ANDROID_LOG_ERROR, "KBBridge",
                                  "JSI error: %s", err.c_str());
            });
      });
}

static void nativeOnDataFromGo(jni::alias_ref<jni::JObject> thiz,
                                jni::alias_ref<jni::JArrayByte> data) {
  auto bridge = g_bridge;
  if (!bridge || !data)
    return;
  JNIEnv *env = jni::Environment::current();
  auto rawArray = data.get();
  auto size = static_cast<int>(env->GetArrayLength(rawArray));
  auto bytes =
      reinterpret_cast<uint8_t *>(env->GetByteArrayElements(rawArray, nullptr));
  bridge->onDataFromGo(bytes, size);
  env->ReleaseByteArrayElements(rawArray, reinterpret_cast<jbyte *>(bytes),
                                JNI_ABORT);
}

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *vm, void *) {
  java_vm = vm;
  return jni::initialize(vm, [] {
    jni::findClassStatic("com/reactnativekb/KbModule")
        ->registerNatives({
            makeNativeMethod("getBindingsInstaller", getBindingsInstaller),
            makeNativeMethod("nativeOnDataFromGo", nativeOnDataFromGo),
        });
  });
}
