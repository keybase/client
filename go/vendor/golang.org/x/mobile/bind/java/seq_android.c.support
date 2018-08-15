// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// C support functions for bindings. This file is copied into the
// generated gomobile_bind package and compiled along with the
// generated binding files.

#include <android/log.h>
#include <errno.h>
#include <jni.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <pthread.h>
#include "seq.h"
#include "_cgo_export.h"

#define NULL_REFNUM 41

// initClasses are only exported from Go if reverse bindings are used.
// If they're not, weakly define a no-op function.
__attribute__((weak)) void initClasses(void) { }

static JavaVM *jvm;
// jnienvs holds the per-thread JNIEnv* for Go threads where we called AttachCurrentThread.
// A pthread key destructor is supplied to call DetachCurrentThread on exit. This trick is
// documented in http://developer.android.com/training/articles/perf-jni.html under "Threads".
static pthread_key_t jnienvs;

static jclass seq_class;
static jmethodID seq_getRef;
static jmethodID seq_decRef;
static jmethodID seq_incRef;
static jmethodID seq_incGoObjectRef;
static jmethodID seq_incRefnum;

static jfieldID ref_objField;

static jclass throwable_class;

// env_destructor is registered as a thread data key destructor to
// clean up a Go thread that is attached to the JVM.
static void env_destructor(void *env) {
	if ((*jvm)->DetachCurrentThread(jvm) != JNI_OK) {
		LOG_INFO("failed to detach current thread");
	}
}

static JNIEnv *go_seq_get_thread_env(void) {
	JNIEnv *env;
	jint ret = (*jvm)->GetEnv(jvm, (void **)&env, JNI_VERSION_1_6);
	if (ret != JNI_OK) {
		if (ret != JNI_EDETACHED) {
			LOG_FATAL("failed to get thread env");
		}
		if ((*jvm)->AttachCurrentThread(jvm, &env, NULL) != JNI_OK) {
			LOG_FATAL("failed to attach current thread");
		}
		pthread_setspecific(jnienvs, env);
	}
	return env;
}

void go_seq_maybe_throw_exception(JNIEnv *env, jobject exc) {
	if (exc != NULL) {
		(*env)->Throw(env, exc);
	}
}

jobject go_seq_get_exception(JNIEnv *env) {
	jthrowable exc = (*env)->ExceptionOccurred(env);
	if (!exc) {
		return NULL;
	}
	(*env)->ExceptionClear(env);
	return exc;
}

jbyteArray go_seq_to_java_bytearray(JNIEnv *env, nbyteslice s, int copy) {
	if (s.ptr == NULL) {
		return NULL;
	}
	jbyteArray res = (*env)->NewByteArray(env, s.len);
	if (res == NULL) {
		LOG_FATAL("NewByteArray failed");
	}
	(*env)->SetByteArrayRegion(env, res, 0, s.len, s.ptr);
	if (copy) {
		free(s.ptr);
	}
	return res;
}

#define surr1 0xd800
#define surr2 0xdc00
#define surr3 0xe000

// Unicode replacement character
#define replacementChar 0xFFFD

#define rune1Max ((1<<7) - 1)
#define rune2Max ((1<<11) - 1)
#define rune3Max ((1<<16) - 1)
// Maximum valid Unicode code point.
#define MaxRune 0x0010FFFF

#define surrogateMin 0xD800
#define surrogateMax 0xDFFF
// 0011 1111
#define maskx 0x3F
// 1000 0000
#define tx 0x80
// 1100 0000
#define t2 0xC0
// 1110 0000
#define t3 0xE0
// 1111 0000
#define t4 0xF0

// encode_rune writes into p (which must be large enough) the UTF-8 encoding
// of the rune. It returns the number of bytes written.
static int encode_rune(uint8_t *p, uint32_t r) {
	if (r <= rune1Max) {
		p[0] = (uint8_t)r;
		return 1;
	} else if (r <= rune2Max) {
		p[0] = t2 | (uint8_t)(r>>6);
		p[1] = tx | (((uint8_t)(r))&maskx);
		return 2;
	} else {
		if (r > MaxRune || (surrogateMin <= r && r <= surrogateMax)) {
			r = replacementChar;
		}
		if (r <= rune3Max) {
			p[0] = t3 | (uint8_t)(r>>12);
			p[1] = tx | (((uint8_t)(r>>6))&maskx);
			p[2] = tx | (((uint8_t)(r))&maskx);
			return 3;
		} else {
			p[0] = t4 | (uint8_t)(r>>18);
			p[1] = tx | (((uint8_t)(r>>12))&maskx);
			p[2] = tx | (((uint8_t)(r>>6))&maskx);
			p[3] = tx | (((uint8_t)(r))&maskx);
			return 4;
		}
	}
}

// utf16_decode decodes an array of UTF16 characters to a UTF-8 encoded
// nstring copy. The support functions and utf16_decode itself are heavily
// based on the unicode/utf8 and unicode/utf16 Go packages.
static nstring utf16_decode(jchar *chars, jsize len) {
	jsize worstCaseLen = 4*len;
	uint8_t *buf = malloc(worstCaseLen);
	if (buf == NULL) {
		LOG_FATAL("utf16Decode: malloc failed");
	}
	jsize nsrc = 0;
	jsize ndst = 0;
	while (nsrc < len) {
		uint32_t r = chars[nsrc];
		nsrc++;
		if (surr1 <= r && r < surr2 && nsrc < len) {
			uint32_t r2 = chars[nsrc];
			if (surr2 <= r2 && r2 < surr3) {
				nsrc++;
				r = (((r-surr1)<<10) | (r2 - surr2)) + 0x10000;
			}
		}
		if (ndst + 4 > worstCaseLen) {
			LOG_FATAL("utf16Decode: buffer overflow");
		}
		ndst += encode_rune(buf + ndst, r);
	}
	struct nstring res = {.chars = buf, .len = ndst};
	return res;
}

nstring go_seq_from_java_string(JNIEnv *env, jstring str) {
	struct nstring res = {NULL, 0};
	if (str == NULL) {
		return res;
	}
	jsize nchars = (*env)->GetStringLength(env, str);
	if (nchars == 0) {
		return res;
	}
	jchar *chars = (jchar *)(*env)->GetStringChars(env, str, NULL);
	if (chars == NULL) {
		LOG_FATAL("GetStringChars failed");
	}
	nstring nstr = utf16_decode(chars, nchars);
	(*env)->ReleaseStringChars(env, str, chars);
	return nstr;
}

nbyteslice go_seq_from_java_bytearray(JNIEnv *env, jbyteArray arr, int copy) {
	struct nbyteslice res = {NULL, 0};
	if (arr == NULL) {
		return res;
	}

	jsize len = (*env)->GetArrayLength(env, arr);
	if (len == 0) {
		return res;
	}
	jbyte *ptr = (*env)->GetByteArrayElements(env, arr, NULL);
	if (ptr == NULL) {
		LOG_FATAL("GetByteArrayElements failed");
	}
	if (copy) {
		void *ptr_copy = (void *)malloc(len);
		if (ptr_copy == NULL) {
			LOG_FATAL("malloc failed");
		}
		memcpy(ptr_copy, ptr, len);
		(*env)->ReleaseByteArrayElements(env, arr, ptr, JNI_ABORT);
		ptr = (jbyte *)ptr_copy;
	}
	res.ptr = ptr;
	res.len = len;
	return res;
}

int32_t go_seq_to_refnum_go(JNIEnv *env, jobject o) {
	if (o == NULL) {
		return NULL_REFNUM;
	}
	return (int32_t)(*env)->CallStaticIntMethod(env, seq_class, seq_incGoObjectRef, o);
}

int32_t go_seq_to_refnum(JNIEnv *env, jobject o) {
	if (o == NULL) {
		return NULL_REFNUM;
	}
	return (int32_t)(*env)->CallStaticIntMethod(env, seq_class, seq_incRef, o);
}

int32_t go_seq_unwrap(jint refnum) {
	JNIEnv *env = go_seq_push_local_frame(0);
	jobject jobj = go_seq_from_refnum(env, refnum, NULL, NULL);
	int32_t goref = go_seq_to_refnum_go(env, jobj);
	go_seq_pop_local_frame(env);
	return goref;
}

jobject go_seq_from_refnum(JNIEnv *env, int32_t refnum, jclass proxy_class, jmethodID proxy_cons) {
	if (refnum == NULL_REFNUM) {
		return NULL;
	}
	if (refnum < 0) { // Go object
		// return new <Proxy>(refnum)
		return (*env)->NewObject(env, proxy_class, proxy_cons, refnum);
	}
	// Seq.Ref ref = Seq.getRef(refnum)
	jobject ref = (*env)->CallStaticObjectMethod(env, seq_class, seq_getRef, (jint)refnum);
	if (ref == NULL) {
		LOG_FATAL("Unknown reference: %d", refnum);
	}
	// Go incremented the reference count just before passing the refnum. Decrement it here.
	(*env)->CallStaticVoidMethod(env, seq_class, seq_decRef, (jint)refnum);
	// return ref.obj
	return (*env)->GetObjectField(env, ref, ref_objField);
}

// go_seq_to_java_string converts a nstring to a jstring.
jstring go_seq_to_java_string(JNIEnv *env, nstring str) {
	jstring s = (*env)->NewString(env, str.chars, str.len/2);
	if (str.chars != NULL) {
		free(str.chars);
	}
	return s;
}

// go_seq_push_local_frame retrieves or creates the JNIEnv* for the current thread
// and pushes a JNI reference frame. Must be matched with call to go_seq_pop_local_frame.
JNIEnv *go_seq_push_local_frame(jint nargs) {
	JNIEnv *env = go_seq_get_thread_env();
	// Given the number of function arguments, compute a conservative bound for the minimal frame size.
	// Assume two slots for each per parameter (Seq.Ref and Seq.Object) and add extra
	// extra space for the receiver, the return value, and exception (if any).
	jint frameSize = 2*nargs + 10;
	if ((*env)->PushLocalFrame(env, frameSize) < 0) {
		LOG_FATAL("PushLocalFrame failed");
	}
	return env;
}

// Pop the current local frame, freeing all JNI local references in it
void go_seq_pop_local_frame(JNIEnv *env) {
	(*env)->PopLocalFrame(env, NULL);
}

void go_seq_inc_ref(int32_t ref) {
	JNIEnv *env = go_seq_get_thread_env();
	(*env)->CallStaticVoidMethod(env, seq_class, seq_incRefnum, (jint)ref);
}

void go_seq_dec_ref(int32_t ref) {
	JNIEnv *env = go_seq_get_thread_env();
	(*env)->CallStaticVoidMethod(env, seq_class, seq_decRef, (jint)ref);
}

JNIEXPORT void JNICALL
Java_go_Seq_init(JNIEnv *env, jclass clazz) {
	if ((*env)->GetJavaVM(env, &jvm) != 0) {
		LOG_FATAL("failed to get JVM");
	}
	if (pthread_key_create(&jnienvs, env_destructor) != 0) {
		LOG_FATAL("failed to initialize jnienvs thread local storage");
	}

	seq_class = (*env)->NewGlobalRef(env, clazz);
	seq_getRef = (*env)->GetStaticMethodID(env, seq_class, "getRef", "(I)Lgo/Seq$Ref;");
	if (seq_getRef == NULL) {
		LOG_FATAL("failed to find method Seq.getRef");
	}
	seq_decRef = (*env)->GetStaticMethodID(env, seq_class, "decRef", "(I)V");
	if (seq_decRef == NULL) {
		LOG_FATAL("failed to find method Seq.decRef");
	}
	seq_incRefnum = (*env)->GetStaticMethodID(env, seq_class, "incRefnum", "(I)V");
	if (seq_incRefnum == NULL) {
		LOG_FATAL("failed to find method Seq.incRefnum");
	}
	seq_incRef = (*env)->GetStaticMethodID(env, seq_class, "incRef", "(Ljava/lang/Object;)I");
	if (seq_incRef == NULL) {
		LOG_FATAL("failed to find method Seq.incRef");
	}
	seq_incGoObjectRef = (*env)->GetStaticMethodID(env, seq_class, "incGoObjectRef", "(Lgo/Seq$GoObject;)I");
	if (seq_incGoObjectRef == NULL) {
		LOG_FATAL("failed to find method Seq.incGoObjectRef");
	}
	jclass ref_class = (*env)->FindClass(env, "go/Seq$Ref");
	if (ref_class == NULL) {
		LOG_FATAL("failed to find the Seq.Ref class");
	}
	ref_objField = (*env)->GetFieldID(env, ref_class, "obj", "Ljava/lang/Object;");
	if (ref_objField == NULL) {
		LOG_FATAL("failed to find the Seq.Ref.obj field");
	}
	initClasses();
}

JNIEXPORT void JNICALL
Java_go_Seq_destroyRef(JNIEnv *env, jclass clazz, jint refnum) {
	DestroyRef(refnum);
}

JNIEXPORT void JNICALL
Java_go_Seq_incGoRef(JNIEnv *env, jclass clazz, jint refnum, jobject ref) {
	IncGoRef(refnum);
}

jclass go_seq_find_class(const char *name) {
	JNIEnv *env = go_seq_push_local_frame(0);
	jclass clazz = (*env)->FindClass(env, name);
	if (clazz == NULL) {
		(*env)->ExceptionClear(env);
	} else {
		clazz = (*env)->NewGlobalRef(env, clazz);
	}
	go_seq_pop_local_frame(env);
	return clazz;
}

jmethodID go_seq_get_static_method_id(jclass clazz, const char *name, const char *sig) {
	JNIEnv *env = go_seq_push_local_frame(0);
	jmethodID m = (*env)->GetStaticMethodID(env, clazz, name, sig);
	if (m == NULL) {
		(*env)->ExceptionClear(env);
	}
	go_seq_pop_local_frame(env);
	return m;
}

jmethodID go_seq_get_method_id(jclass clazz, const char *name, const char *sig) {
	JNIEnv *env = go_seq_push_local_frame(0);
	jmethodID m = (*env)->GetMethodID(env, clazz, name, sig);
	if (m == NULL) {
		(*env)->ExceptionClear(env);
	}
	go_seq_pop_local_frame(env);
	return m;
}

void go_seq_release_byte_array(JNIEnv *env, jbyteArray arr, jbyte* ptr) {
	if (ptr != NULL) {
		(*env)->ReleaseByteArrayElements(env, arr, ptr, 0);
	}
}

int go_seq_isinstanceof(jint refnum, jclass clazz) {
	JNIEnv *env = go_seq_push_local_frame(0);
	jobject obj = go_seq_from_refnum(env, refnum, NULL, NULL);
	jboolean isinst = (*env)->IsInstanceOf(env, obj, clazz);
	go_seq_pop_local_frame(env);
	return isinst;
}
