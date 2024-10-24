package com.reactnativekb

import android.util.Log
import keybase.Keybase

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableArray

class NativeLogger(reactContext: ReactApplicationContext?) : ReactContextBaseJavaModule(reactContext) {
    @Override
    override fun getName(): String {
        return NAME
    }

    companion object {
        private val NAME: String = "NativeLogger"
        private val RN_NAME: String = "ReactNativeJS"
        fun rawLog(tag: String, jsonLog: String) {
            Log.i(tag + NAME, jsonLog)
        }

        private fun formatLine(tagPrefix: String, toLog: String): String {
            // Copies the Style JS outputs in native/logger.native.tsx
            return tagPrefix + NAME + ": [" + System.currentTimeMillis() + ",\"" + toLog + "\"]"
        }

        fun error(log: String) {
            Keybase.logToService(formatLine("e", log))
        }

        fun error(log: String, tr: Throwable?) {
            Keybase.logToService(formatLine("e", log + Log.getStackTraceString(tr)))
        }

        fun info(log: String) {
            Keybase.logToService(formatLine("i", log))
        }

        fun info(log: String, tr: Throwable?) {
            Keybase.logToService(formatLine("i", log + Log.getStackTraceString(tr)))
        }

        fun warn(log: String) {
            Keybase.logToService(formatLine("w", log))
        }

        fun warn(log: String, tr: Throwable) {
            Keybase.logToService(formatLine("w", log + Log.getStackTraceString(tr)))
        }
    }
}
