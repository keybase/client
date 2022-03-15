// from https://github.com/ammarahm-ed/react-native-jsi-template/blob/master/android/cpp-adapter.cpp
#include <jni.h>
#include <sys/types.h>
#include "pthread.h"
#include <jsi/jsi.h>

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
            // Failed to set thread-specific value for key. Throw an exception if you want to.
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
    auto get_env_result = java_vm->GetEnv((void **) &env, JNI_VERSION_1_6);
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
    auto rpcOnGo = Function::createFromHostFunction(jsiRuntime, PropNameID::forAscii(jsiRuntime, "rpcOnGo"), 1,
      [](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
          string b64 = arguments[0].getString(runtime).utf8(runtime);
          JNIEnv *jniEnv = GetJniEnv();
          java_class = jniEnv->GetObjectClass(java_object);
          jmethodID rpcOnGo = jniEnv->GetMethodID(java_class, "rpcOnGo", "(Ljava/lang/String;)V");
          jstring jstr1 = string2jstring(jniEnv, b64);
          jvalue params[1];
          params[0].l = jstr1;
          jniEnv->CallVoidMethodA(java_object, rpcOnGo, params);
          return Value(true);
      });
    jsiRuntime.global().setProperty(jsiRuntime, "rpcOnGo", move(rpcOnGo));
}

extern "C"
JNIEXPORT void JNICALL
Java_io_keybase_ossifrage_modules_GoJSIBridge_nativeInstall(JNIEnv *env, jobject thiz, jlong jsi) {
    auto runtime = reinterpret_cast<facebook::jsi::Runtime *>(jsi);
    if (runtime) {
        install(*runtime);
    }
    env->GetJavaVM(&java_vm);
    java_object = env->NewGlobalRef(thiz);
}