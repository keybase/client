package com.reactnativekb

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import java.util.Map

abstract class KbSpec(context: ReactApplicationContext?) : ReactContextBaseJavaModule(context) {

    abstract fun getTypedExportedConstants(): MutableMap<String, Any>
    abstract fun install(): Boolean
    abstract fun getDefaultCountryCode(promise: Promise)
    abstract fun logSend(status: String, feedback: String, sendLogs: Boolean, sendMaxBytes: Boolean, traceDir: String, cpuProfileDir: String, promise: Promise)
    abstract fun androidOpenSettings()
    abstract fun androidSetSecureFlagSetting(setSecure: Boolean, promise: Promise)
    abstract fun androidGetSecureFlagSetting(promise: Promise)
    abstract fun androidShare(uriPath: String, mimeType: String, promise: Promise)
    abstract fun androidShareText(text: String, mimeType: String, promise: Promise)
    abstract fun androidCheckPushPermissions(promise: Promise)
    abstract fun androidRequestPushPermissions(promise: Promise)
    abstract fun androidGetRegistrationToken(promise: Promise)
    abstract fun androidUnlink(path: String, promise: Promise)
    abstract fun androidAddCompleteDownload(config: ReadableMap, promise: Promise)
    abstract fun androidAppColorSchemeChanged(prefString: String)
    abstract fun androidSetApplicationIconBadgeNumber(badge: Double)
    abstract fun androidGetInitialShareFileUrls(promise: Promise)
    abstract fun engineReset()
    abstract fun engineStart()
    abstract fun shareListenersRegistered()
    abstract fun addListener(eventType: String)
    abstract fun removeListeners(count: Double)
    abstract fun iosGetHasShownPushPrompt(promise: Promise)

}
