#include <jni.h>
#include "react-native-kb.h"

extern "C"
JNIEXPORT jint JNICALL
Java_com_kb_KbModule_nativeMultiply(JNIEnv *env, jclass type, jdouble a, jdouble b) {
    return kb::multiply(a, b);
}
