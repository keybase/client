// from
// https://github.com/ammarahm-ed/react-native-jsi-template/blob/master/android/cpp-adapter.cpp
#include "pthread.h"
#include "rpc.h"
#include <ReactCommon/CallInvoker.h>
#include <ReactCommon/CallInvokerHolder.h>
#include <fbjni/fbjni.h>
#include <jni.h>
#include <jsi/jsi.h>
#include <sys/types.h>

using namespace facebook;
using namespace facebook::jsi;
using namespace std;

JavaVM *java_vm;
jclass java_class;
jobject java_object;

/**
 * A simple callback function that allows us to detach current JNI Environment
 * when the thread
 * See https://stackoverflow.com/a/30026231 for detailed explanation
 */

void DeferThreadDetach(JNIEnv *env) {
  static pthread_key_t thread_key;

  // Set up a Thread Specific Data key, and a callback that
  // will be executed when a thread is destroyed.
  // This is only done once, across all threads, and the value
  // associated with the key for any given thread will initially
  // be NULL.
  static auto run_once = [] {
    const auto err = pthread_key_create(&thread_key, [](void *ts_env) {
      if (ts_env) {
        java_vm->DetachCurrentThread();
      }
    });
    if (err) {
      // Failed to create TSD key. Throw an exception if you want to.
    }
    return 0;
  }();

  // For the callback to actually be executed when a thread exits
  // we need to associate a non-NULL value with the key on that thread.
  // We can use the JNIEnv* as that value.
  const auto ts_env = pthread_getspecific(thread_key);
  if (!ts_env) {
    if (pthread_setspecific(thread_key, env)) {
      // Failed to set thread-specific value for key. Throw an exception if you
      // want to.
    }
  }
}

/**
 * Get a JNIEnv* valid for this thread, regardless of whether
 * we're on a native thread or a Java thread.
 * If the calling thread is not currently attached to the JVM
 * it will be attached, and then automatically detached when the
 * thread is destroyed.
 *
 * See https://stackoverflow.com/a/30026231 for detailed explanation
 */
JNIEnv *GetJniEnv() {
  JNIEnv *env = nullptr;
  // We still call GetEnv first to detect if the thread already
  // is attached. This is done to avoid setting up a DetachCurrentThread
  // call on a Java thread.

  // g_vm is a global.
  auto get_env_result = java_vm->GetEnv((void **)&env, JNI_VERSION_1_6);
  if (get_env_result == JNI_EDETACHED) {
    if (java_vm->AttachCurrentThread(&env, NULL) == JNI_OK) {
      DeferThreadDetach(env);
    } else {
      // Failed to attach thread. Throw an exception if you want to.
    }
  } else if (get_env_result == JNI_EVERSION) {
    // Unsupported JNI version. Throw an exception if you want to.
  }
  return env;
}

static jstring string2jstring(JNIEnv *env, const string &str) {
  return (*env).NewStringUTF(str.c_str());
}

void install(facebook::jsi::Runtime &jsiRuntime) {
  auto rpcOnGoWrap = [](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
        return RpcOnGo(
            runtime, thisValue, arguments, count, [](void *ptr, size_t size) {
              JNIEnv *jniEnv = GetJniEnv();
              java_class = jniEnv->GetObjectClass(java_object);
              jmethodID rpcOnGo =
                  jniEnv->GetMethodID(java_class, "rpcOnGo", "([B)V");
              jbyteArray jba = jniEnv->NewByteArray(size);
              jniEnv->SetByteArrayRegion(jba, 0, size, (jbyte *)ptr);
              jvalue params[1];
              params[0].l = jba;
              jniEnv->CallVoidMethodA(java_object, rpcOnGo, params);
            });
      };
  jsiRuntime.global().setProperty(jsiRuntime, "rpcOnGo", 
      Function::createFromHostFunction(
      jsiRuntime, PropNameID::forAscii(jsiRuntime, "rpcOnGo"), 1, move(rpcOnGoWrap)));
}

extern "C" JNIEXPORT void JNICALL
Java_com_reactnativekb_KbModuleImpl_nativeInstallJSI(JNIEnv *env, jobject thiz,
                                                     jlong jsi) {
  auto runtime = reinterpret_cast<facebook::jsi::Runtime *>(jsi);
  if (runtime) {
    install(*runtime);
  }
  env->GetJavaVM(&java_vm);
  java_object = env->NewGlobalRef(thiz);
}

extern "C" JNIEXPORT void JNICALL
Java_com_reactnativekb_KbModuleImpl_nativeEmit(JNIEnv *env, jclass clazz,
                                               jlong jsi,
                                               jobject boxedCallInvokerHolder,
                                               jbyteArray data) {
  auto rPtr = reinterpret_cast<facebook::jsi::Runtime *>(jsi);
  auto &runtime = *rPtr;
  auto boxedCallInvokerRef = jni::make_local(boxedCallInvokerHolder);
  auto callInvokerHolder =
      jni::dynamic_ref_cast<react::CallInvokerHolder::javaobject>(
          boxedCallInvokerRef);
  auto callInvoker = callInvokerHolder->cthis()->getCallInvoker();

  auto size = static_cast<int>(env->GetArrayLength(data));
  auto payloadBytes =
      reinterpret_cast<uint8_t *>(env->GetByteArrayElements(data, nullptr));
  auto values = PrepRpcOnJS(runtime, payloadBytes, size);
  callInvoker->invokeAsync([values, &runtime]() {
    RpcOnJS(runtime, values, [](const std::string &err) {
      JNIEnv *jniEnv = GetJniEnv();
      java_class = jniEnv->GetObjectClass(java_object);
      jmethodID log =
          jniEnv->GetMethodID(java_class, "log", "(Ljava/lang/String;)V");
      auto s = string2jstring(jniEnv, err);
      jvalue params[1];
      params[0].l = s;
      jniEnv->CallVoidMethodA(java_object, log, params);
    });
  });
}
