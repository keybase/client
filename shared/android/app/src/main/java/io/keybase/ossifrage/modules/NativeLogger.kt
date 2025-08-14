package io.keybase.ossifrage.modules

import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

class NativeLogger(reactContext: ReactApplicationContext?) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String {
        return NAME
    }

    companion object {
        private const val NAME = "NativeLogger"
        private const val RN_NAME = "ReactNativeJS"
        private fun rawLog(tag: String, jsonLog: String) {
            Log.i(tag + NAME, jsonLog)
        }

        private fun formatLine(tagPrefix: String, toLog: String): String {
            // Copies the Style JS outputs in native/logger.native.tsx
            return tagPrefix + NAME + ": [" + System.currentTimeMillis() + ",\"" + toLog + "\"]"
        }

        fun error(log: String) {
            Log.e(RN_NAME, formatLine("e", log))
        }

        fun error(log: String, tr: Throwable?) {
            Log.e(RN_NAME, formatLine("e", log + Log.getStackTraceString(tr)))
        }

        fun info(log: String) {
            Log.i(RN_NAME, formatLine("i", log))
        }

        fun info(log: String, tr: Throwable?) {
            Log.i(RN_NAME, formatLine("i", log + Log.getStackTraceString(tr)))
        }

        fun warn(log: String) {
            Log.i(RN_NAME, formatLine("w", log))
        }

        fun warn(log: String, tr: Throwable?) {
            Log.i(RN_NAME, formatLine("w", log + Log.getStackTraceString(tr)))
        }
    }
}
