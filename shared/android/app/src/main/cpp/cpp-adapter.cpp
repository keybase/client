#include <jni.h>
#include <jsi/jsi.h>

using namespace facebook;

std::string getPropertyAsStringOrEmptyFromObject(jsi::Object& object, const std::string& propertyName, jsi::Runtime& runtime) {
    jsi::Value value = object.getProperty(runtime, propertyName.c_str());
    return value.isString() ? value.asString(runtime).utf8(runtime) : "";
}

void install(jsi::Runtime& jsiRuntime) {
    // MMKV.createNewInstance()
    // auto mmkvCreateNewInstance = jsi::Function::createFromHostFunction(jsiRuntime,
    //                                                                    jsi::PropNameID::forAscii(jsiRuntime, "temp"),
    //                                                                    1,
    //                                                                    [](jsi::Runtime& runtime,
    //                                                                       const jsi::Value& thisValue,
    //                                                                       const jsi::Value* arguments,
    //                                                                       size_t count) -> jsi::Value {
    //                                                                      jsi::Object config = arguments[0].asObject(runtime);
    //                                                                      return jsi::Object::createFromHostObject(runtime, instance);
    //                                                                    });
    // jsiRuntime.global().setProperty(jsiRuntime, "mmkvCreateNewInstance", std::move(mmkvCreateNewInstance));
}

// std::string jstringToStdString(JNIEnv *env, jstring jStr) {
//     if (!jStr) return "";

//     const auto stringClass = env->GetObjectClass(jStr);
//     const auto getBytes = env->GetMethodID(stringClass, "getBytes", "(Ljava/lang/String;)[B");
//     const auto stringJbytes = (jbyteArray) env->CallObjectMethod(jStr, getBytes, env->NewStringUTF("UTF-8"));

//     auto length = (size_t) env->GetArrayLength(stringJbytes);
//     auto pBytes = env->GetByteArrayElements(stringJbytes, nullptr);

//     std::string ret = std::string((char *)pBytes, length);
//     env->ReleaseByteArrayElements(stringJbytes, pBytes, JNI_ABORT);

//     env->DeleteLocalRef(stringJbytes);
//     env->DeleteLocalRef(stringClass);
//     return ret;
// }

// extern "C"
// JNIEXPORT void JNICALL
// Java_com_reactnativemmkv_MmkvModule_nativeInstall(JNIEnv *env, jobject clazz, jlong jsiPtr, jstring path) {
//     MMKV::initializeMMKV(jstringToStdString(env, path));

//     auto runtime = reinterpret_cast<jsi::Runtime*>(jsiPtr);
//     if (runtime) {
//         install(*runtime);
//     }
//     // if runtime was nullptr, MMKV will not be installed. This should only happen while Remote Debugging (Chrome), but will be weird either way.
// }
