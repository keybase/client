package com.reactnativekb

import android.app.Activity
import android.app.DownloadManager
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.text.format.DateFormat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.turbomodule.core.interfaces.TurboModuleWithJSIBindings
import com.facebook.react.turbomodule.core.interfaces.BindingsInstallerHolder
import com.facebook.proguard.annotations.DoNotStrip
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import java.io.BufferedReader
import java.io.File
import java.io.FileNotFoundException
import java.io.FileReader
import java.io.IOException
import java.lang.reflect.Method
import java.util.concurrent.atomic.AtomicBoolean
import keybase.Keybase
import keybase.Keybase.readArr
import keybase.Keybase.version
import keybase.Keybase.writeArr

class KbModule(reactContext: ReactApplicationContext?) : KbSpec(reactContext), TurboModuleWithJSIBindings {
    private val misTestDevice: Boolean
    private val reactContext: ReactApplicationContext

    @DoNotStrip
    external override fun getBindingsInstaller(): BindingsInstallerHolder
    private external fun nativeOnDataFromGo(data: ByteArray)
    private external fun nativeInvalidate()
    private external fun nativeResetRecv()

    private var lifecycleListenerRegistered = false

    override fun getName(): String {
        return NAME
    }

    // mEventEmitterCallback is only set once JS creates the TurboModule;
    // the generated emit helpers would NPE before then.
    private fun canEmit(): Boolean = mEventEmitterCallback != null

    @ReactMethod
    override fun clearLocalLogs(promise: Promise) {
        promise.resolve(null)
    }

    @ReactMethod
    override fun setEnablePasteImage(enabled: Boolean) {
        // not used
    }

    /**
     * Gets a field from the project's BuildConfig. This is useful when, for example, flavors
     * are used at the project level to set custom fields.
     * @param context       Used to find the correct file
     * @param fieldName     The name of the field-to-access
     * @return              The value of the field, or `null` if the field is not found.
     */
    private fun getBuildConfigValue(fieldName: String): Any?  {
        try {
            val clazz: Class<*> = Class.forName("${reactContext.packageName}.BuildConfig")
            val field = clazz.getField(fieldName)
            return field.get(null)
        } catch (e: ClassNotFoundException) {
            e.printStackTrace()
        } catch (e: NoSuchFieldException) {
            e.printStackTrace()
        } catch (e: IllegalAccessException) {
            e.printStackTrace()
        }
        return null
    }

    private fun readGuiConfig(): String? {
        return GuiConfig.getInstance(reactContext.filesDir)?.asString()
    }

    private data class KbConstants(
        val isDeviceSecure: Boolean,
        val versionCode: String,
        val versionName: String,
        val cacheDir: String,
        val downloadDir: String,
        val serverConfig: String,
        val uses24HourClock: Boolean,
        val version: String,
    )

    // getTypedConstants is a blocking synchronous JS call that does file I/O
    // and reflection; built once, prewarmed off the JS thread in init.
    private val cachedConstants: KbConstants by lazy { buildConstants() }

    private fun buildConstants(): KbConstants {
        var isDeviceSecure = false
        try {
            val keyguardManager: KeyguardManager = reactContext.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            isDeviceSecure = keyguardManager.isKeyguardSecure
        } catch (e: Exception) {
            NativeLogger.warn(": Error reading keyguard secure state", e)
        }
        var serverConfig = ""
        try {
            serverConfig = ReadFileAsString.read("${reactContext.cacheDir.absolutePath}/Keybase/keybase.app.serverConfig")
        } catch (e: Exception) {
            NativeLogger.warn(": Error reading server config", e)
        }
        return KbConstants(
            isDeviceSecure = isDeviceSecure,
            versionCode = getBuildConfigValue("VERSION_CODE").toString(),
            versionName = getBuildConfigValue("VERSION_NAME").toString(),
            cacheDir = reactContext.cacheDir?.absolutePath ?: "",
            downloadDir = reactContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)?.absolutePath ?: "",
            serverConfig = serverConfig,
            uses24HourClock = DateFormat.is24HourFormat(reactContext),
            version = version(),
        )
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    override fun getTypedConstants(): WritableMap {
        val c = cachedConstants
        val constants: WritableMap = Arguments.createMap()
        constants.putBoolean("androidIsDeviceSecure", c.isDeviceSecure)
        constants.putBoolean("androidIsTestDevice", misTestDevice)
        constants.putString("appVersionCode", c.versionCode)
        constants.putString("appVersionName", c.versionName)
        // System dark mode (uiMode night mask) exists on Q+.
        constants.putBoolean("darkModeSupported", Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
        constants.putString("fsCacheDir", c.cacheDir)
        constants.putString("fsDownloadDir", c.downloadDir)
        // gui_config.json changes at runtime (route persistence), and JS re-reads
        // these constants on a dev reload; read it fresh so a reload doesn't
        // restore a stale launch-time route.
        constants.putString("guiConfig", readGuiConfig())
        constants.putString("serverConfig", c.serverConfig)
        constants.putBoolean("uses24HourClock", c.uses24HourClock)
        constants.putString("version", c.version)
        return constants
    }

    // Logging
    @ReactMethod
    override fun logSend(status: String, feedback: String, sendLogs: Boolean, sendMaxBytes: Boolean, traceDir: String, cpuProfileDir: String, promise: Promise) {
        if (misTestDevice) {
            return
        }
        try {
            val logID: String = Keybase.logSend(status, feedback, sendLogs, sendMaxBytes, traceDir, cpuProfileDir)
            promise.resolve(logID)
        } catch (e: Exception) {
            promise.reject(e)
        }
    }

    @ReactMethod
    override fun shareListenersRegistered() {
        try {
            val activity: Activity? = reactContext.currentActivity
            if (activity != null) {
                val m: Method = activity.javaClass.getMethod("shareListenersRegistered")
                m.invoke(activity)
            }
        } catch (ex: Exception) {
            NativeLogger.warn("Error calling shareListenersRegistered", ex)
        }
    }

    // Sharing
    @ReactMethod
    override fun androidShare(uriPath: String, mimeType: String, promise: Promise) {
        val file = File(uriPath)
        val intent: Intent = Intent(Intent.ACTION_SEND).setType(mimeType)
        if (mimeType.startsWith("text/")) {
            handleTextFileSharing(file, intent, promise)
        } else {
            handleNonTextFileSharing(file, intent, promise)
        }
    }

    private fun handleTextFileSharing(file: File, intent: Intent, promise: Promise) {
        try {
            BufferedReader(FileReader(file)).use { br ->
                val textBuilder = StringBuilder()
                var text: String? = null
                var isFirst = true
                while (textBuilder.length < MAX_TEXT_FILE_SIZE && br.readLine().also { text = it } != null) {
                    if (!isFirst) {
                        textBuilder.append(LINE_SEPARATOR)
                    }
                    textBuilder.append(text)
                    isFirst = false
                }
                intent.putExtra(Intent.EXTRA_TEXT, textBuilder.toString())
            }
        } catch (ex: FileNotFoundException) {
            promise.reject(Exception("File not found"))
            return
        } catch (ex: IOException) {
            promise.reject(Exception("Error reading the file"))
            return
        }
        startSharing(intent, promise)
    }

    private fun handleNonTextFileSharing(file: File, intent: Intent, promise: Promise) {
        try {
            // note in JS initPlatformSpecific changes the cache dir so this works
            val fileUri: Uri = FileProvider.getUriForFile(reactContext, "${reactContext.packageName}.fileprovider", file)
            intent.putExtra(Intent.EXTRA_STREAM, fileUri)
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            startSharing(intent, promise)
        } catch (ex: Exception) {
            promise.reject(Error("Error sharing file ${ex.localizedMessage}"))
        }
    }

    private fun startSharing(intent: Intent, promise: Promise) {
        val chooser: Intent = Intent.createChooser(intent, "Send to")
        // Android 5.1.1 fails `startActivity` below without this flag in the Intent.
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(chooser)
        promise.resolve(true)
    }

    @ReactMethod
    override fun androidShareText(text: String, mimeType: String, promise: Promise) {
        val intent: Intent = Intent(Intent.ACTION_SEND).setType(mimeType)
        intent.putExtra(Intent.EXTRA_TEXT, text)
        startSharing(intent, promise)
    }

    // Push
    @ReactMethod
    override fun checkPushPermissions(promise: Promise) {
        val managerCompat: NotificationManagerCompat = NotificationManagerCompat.from(reactContext)
        promise.resolve(managerCompat.areNotificationsEnabled())
    }

    @ReactMethod
    override fun requestPushPermissions(promise: Promise) {
        ensureFirebase()
        checkPushPermissions(promise)
    }

    private fun ensureFirebase() {
        val firebaseInitialized = FirebaseApp.getApps(reactContext).size == 1
        if (!firebaseInitialized) {
            FirebaseApp.initializeApp(reactContext,
                    FirebaseOptions.Builder()
                            .setApplicationId(getBuildConfigValue("APPLICATION_ID").toString())
                            .setProjectId("keybase-c30fb")
                            .setGcmSenderId("9603251415")
                            .build()
            )
        }
    }

    @ReactMethod
    override fun getRegistrationToken(promise: Promise) {
        ensureFirebase()
        FirebaseMessaging.getInstance().getToken()
                .addOnCompleteListener { task ->
                        if (!task.isSuccessful) {
                            NativeLogger.info("Fetching FCM registration token failed ${task.exception}")
                            promise.reject("E_FCM_TOKEN", "Fetching FCM registration token failed")
                            return@addOnCompleteListener
                        }

                        // Get new FCM registration token
                        val token: String? = task.result
                        if (token == null) {
                            promise.reject("E_FCM_TOKEN", "null token")
                            return@addOnCompleteListener
                         }
                        NativeLogger.info("Got token: $token")
                        promise.resolve(token)
                    }
    }

    init {
        this.reactContext = reactContext!!
        misTestDevice = isTestDevice(reactContext)
        Thread { cachedConstants }.start()
        // Published last: the reader thread reads `instance` and must never
        // see a partially constructed module.
        instance = this
    }

    private fun normalizePath(path: String): String {
        if (!Regex("""\w+\:.*""").matches(path)) {
            return path
        }
        if (path.startsWith("file://")) {
            return path.replace("file://", "")
        }
        val uri: Uri = Uri.parse(path)
        if (path.startsWith(FILE_PREFIX_BUNDLE_ASSET)) {
            return path
        } else {
            return PathResolver.getRealPathFromURI(reactContext, uri) ?: ""
        }
    }

    @ReactMethod
    override fun androidAddCompleteDownload(config: ReadableMap, promise: Promise) {
        val dm: DownloadManager = reactContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        if (!config.hasKey("path")) {
            promise.reject("EINVAL", "addCompleteDownload config or path missing.")
            return
        }
        val path = normalizePath(config.getString("path") ?: "")

        if (path == "") {
            promise.reject("EINVAL", "addCompleteDownload can not resolve URI:" + config.getString("path"))
            return
        }
        try {
            val target = File(path)
            val size = if (target.exists()) target.length() else 0L
            @Suppress("DEPRECATION")
            dm.addCompletedDownload(
                    if (config.hasKey("title")) config.getString("title") else "",
                    if (config.hasKey("description")) config.getString("description") else "",
                    true,
                    if (config.hasKey("mime")) config.getString("mime") else null,
                    path,
                    size,
                    config.hasKey("showNotification") && config.getBoolean("showNotification")
            )
            promise.resolve(null)
        } catch (ex: Exception) {
            promise.reject("EUNSPECIFIED", ex.localizedMessage)
        }
    }

    // Dark mode
    // Same type as DarkModePreference: 'system' | 'alwaysDark' | 'alwaysLight'
    @ReactMethod
    override fun androidAppColorSchemeChanged(prefString: String) {
        try {
            val activity: Activity? = reactContext.currentActivity
            if (activity != null) {
                val m: Method = activity.javaClass.getMethod("setBackgroundColor", DarkModePreference::class.java)
                val pref: DarkModePreference = DarkModePrefHelper.fromString(prefString)
                m.invoke(activity, pref)
            }
        } catch (ex: Exception) {
            NativeLogger.warn("Error calling androidAppColorSchemeChanged", ex)
        }
    }

    @ReactMethod
    override fun setApplicationIconBadgeNumber(badge: Double) {
        // Android manages badge counts automatically via notification channels.
    }

    @ReactMethod
    override fun getInitialNotification(promise: Promise) {
        // Clear on read so it behaves as a one-shot, matching iOS.
        val bundle = KbModule.initialNotificationBundle
        KbModule.initialNotificationBundle = null
        if (bundle != null) {
            try {
                @Suppress("UNCHECKED_CAST")
                val payload: WritableMap = Arguments.fromBundle(bundle) as WritableMap
                promise.resolve(payload)
            } catch (e: Exception) {
                promise.resolve(null)
            }
        } else {
            promise.resolve(null)
        }
    }

    private fun emitPushNotificationInternal(notification: Bundle) {
        if (reactContext.hasActiveReactInstance() && canEmit()) {
            try {
                val payload = Arguments.fromBundle(notification)
                emitOnPushNotification(payload)
            } catch (e: Exception) {
                NativeLogger.error("emitPushNotificationInternal failed to emit: " + e.message)
            }
        } else {
            NativeLogger.warn("emitPushNotificationInternal no active react instance")
        }
    }

    internal fun emitShareDataInternal(data: WritableMap) {
        if (reactContext.hasActiveReactInstance() && canEmit()) {
            try {
                emitOnShareData(data)
            } catch (e: Exception) {
                NativeLogger.error("emitShareDataInternal failed to emit: " + e.message)
            }
        } else {
            NativeLogger.warn("emitShareDataInternal no active react instance")
        }
    }

    @ReactMethod
    override fun removeAllPendingNotificationRequests() {
    }

    @ReactMethod
    override fun addNotificationRequest(config: ReadableMap, promise: Promise) {
        val body = config.getString("body")
        val id = config.getString("id")

        if (body == null || id == null) {
            promise.reject("invalid_config", "body and id are required")
            return
        }

        val notificationManager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        val channelId = "keybase_notifications"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = android.app.NotificationChannel(
                channelId,
                "Keybase Notifications",
                android.app.NotificationManager.IMPORTANCE_DEFAULT
            )
            notificationManager.createNotificationChannel(channel)
        }

        val notification = NotificationCompat.Builder(reactContext, channelId)
            .setContentText(body)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .build()

        notificationManager.notify(id.hashCode(), notification)
        promise.resolve(null)
    }

    private fun relayReset() {
        if (!reactContext.hasActiveReactInstance() || !canEmit()) {
            NativeLogger.info("$NAME: JS Bridge is dead, Can't send EOF message")
        } else {
            emitOnMetaEvent(RPC_META_EVENT_ENGINE_RESET)
        }
    }

    // Synchronous, best-effort mirror of relayReset()'s own check, callable
    // from the reader thread: lets a caller decide whether an emit has any
    // chance of being delivered before committing to it.
    internal fun canDeliverReset(): Boolean = reactContext.hasActiveReactInstance() && canEmit()

    // No current caller (kept for future use).
    @ReactMethod
    override fun engineReset() {
        try {
            Keybase.reset()
            nativeResetRecv()
            relayReset()
        } catch (e: Exception) {
            NativeLogger.error("Exception in engineReset", e)
        }
    }

    @ReactMethod
    override fun notifyJSReady() {
        NativeLogger.info("JS signaled ready, starting ReadFromKBLib loop")
        try {
            // Signal to Go that JS is ready. This is a sync.Once on the Go
            // side, so calling it again after a reload is free.
            Keybase.notifyJSReady()

            startReadLoop()

            // Register once; tear down the Go connection on destroy. The read
            // loop itself is never restarted — see startReadLoop.
            if (!lifecycleListenerRegistered) {
                lifecycleListenerRegistered = true
                reactContext.addLifecycleEventListener(object : LifecycleEventListener {
                    override fun onHostResume() {
                    }

                    override fun onHostPause() {
                    }

                    override fun onHostDestroy() {
                        destroy()
                    }
                })
            }
        } catch (e: Exception) {
            NativeLogger.error("Exception in notifyJSReady", e)
        }
    }

    // Exactly one reader exists for the life of the process. Go's readArr
    // hands back a view of a single shared buffer and is documented as
    // "called serially by the mobile run loops": a second concurrent reader
    // corrupts both deliveries and the (not thread safe) msgpack unpacker
    // behind nativeOnDataFromGo. Stopping it isn't possible either — a thread
    // parked in the JNI readArr call ignores interrupts, so shutdownNow()
    // returns while the old reader is still live and about to swallow one
    // more message. So the loop outlives any module instance and forwards to
    // whichever bridge is currently installed.
    private fun startReadLoop() {
        if (readLoopStarted.compareAndSet(false, true)) {
            Thread(ReadFromKBLib(), "ReadFromKBLib").apply {
                isDaemon = true
                start()
            }
        }
    }

    // JSI. Deliberately not an inner class: the thread outlives every module
    // instance, so capturing one would pin its ReactContext (and Activity) for
    // the life of the process. It forwards to whichever module is current.
    private class ReadFromKBLib : Runnable {
        private var loggedEmptyRead = false
        private var readErrorCount = 0
        private var nonEofErrorCount = 0
        private var emitBackoffMs = 0L
        private var emitNotBeforeMs = 0L

        // A read error retries every ~100ms; if the connection can't be
        // re-established that is a ~10Hz flood into the uploadable log.
        // Unlike loggedEmptyRead (a one-shot degenerate case) a recurring
        // read error is exactly what an operator needs to see recur, so
        // this logs the first few occurrences, then backs off to every
        // Nth rather than going silent.
        private fun shouldLogReadError(): Boolean {
            readErrorCount++
            return readErrorCount <= 5 || readErrorCount % 50 == 0
        }

        // Separate counter for non-EOF exceptions: readErrorCount only resets
        // on a successful read, so a sustained EOF outage can drive it into
        // the hundreds before a genuine non-EOF failure arrives -- sharing
        // the counter would let the `% 50` throttle swallow the very log line
        // (with stack trace) an operator needs at exactly that transition.
        // A dedicated counter guarantees the first few non-EOF exceptions
        // always log regardless of how long the preceding EOF flood ran.
        private fun shouldLogNonEofError(): Boolean {
            nonEofErrorCount++
            return nonEofErrorCount <= 5 || nonEofErrorCount % 50 == 0
        }

        // Throttles the kb-engine-reset EMIT, separately from the log line
        // above -- they have different cadences and must not share a
        // counter. JS's disconnectCallback does a full session-cancel sweep
        // (with a log of its own) and connectCallback re-dispatches the
        // bootstrap path, so a connection that cannot be re-dialed must not
        // re-trigger those at ~10Hz. The first failure emits immediately so
        // JS learns promptly, then backs off exponentially to a ceiling.
        // Reset alongside readErrorCount on the next successful read, so a
        // later, unrelated episode again emits promptly.
        //
        // `deliverable` gates the backoff advance itself, not just the emit:
        // an emit that has nowhere to go (no active react instance / can't
        // emit yet) must not cost a full backoff window, or a dropped
        // notification during e.g. a reload delays the next one that could
        // actually be delivered.
        private fun shouldEmitEngineReset(deliverable: Boolean): Boolean {
            val now = android.os.SystemClock.elapsedRealtime()
            if (now < emitNotBeforeMs || !deliverable) {
                return false
            }
            emitBackoffMs = if (emitBackoffMs == 0L) EMIT_BACKOFF_INITIAL_MS else minOf(emitBackoffMs * 2, EMIT_BACKOFF_CEILING_MS)
            emitNotBeforeMs = now + emitBackoffMs
            return true
        }

        override fun run() {
            while (true) {
                try {
                    val data: ByteArray? = readArr()
                    if (data == null || data.isEmpty()) {
                        // Not the idle path: readArr blocks until there is
                        // data, so an empty non-error result is degenerate --
                        // reachable if Init never ran and the shared buffer is
                        // zero-length, which would otherwise spin silently.
                        if (!loggedEmptyRead) {
                            NativeLogger.warn("$NAME: read returned no data; is Keybase initialized?")
                            loggedEmptyRead = true
                        }
                        Thread.sleep(10)
                        continue
                    }
                    readErrorCount = 0
                    nonEofErrorCount = 0
                    emitBackoffMs = 0L
                    emitNotBeforeMs = 0L
                    instance?.nativeOnDataFromGo(data)
                } catch (e: InterruptedException) {
                    Thread.currentThread().interrupt()
                    return
                } catch (e: Exception) {
                    // readArr already called Reset() on the Go side, so the
                    // connection JS thinks it has is gone and every in-flight
                    // RPC is dead. EOF is the ordinary shape of this, not a
                    // surprise -- but JS still has to be told, or its callers
                    // hang forever.
                    if (e.message != null && e.message.equals("Read error: EOF")) {
                        // EOF is the ordinary shape of a persistent-read
                        // outage, not a surprise, but at this loop's ~100ms
                        // retry it is still a ~10Hz flood into the uploadable
                        // log if left unthrottled.
                        if (shouldLogReadError()) {
                            NativeLogger.info("Got EOF from read, connection reset (count=$readErrorCount).")
                        }
                    } else if (shouldLogNonEofError()) {
                        NativeLogger.error("Exception in ReadFromKBLib.run (count=$nonEofErrorCount)", e)
                    }
                    val inst = instance
                    if (inst != null) {
                        inst.onRpcConnectionReset(shouldEmitEngineReset(inst.canDeliverReset()))
                    }
                    try { Thread.sleep(100) } catch (ie: InterruptedException) { Thread.currentThread().interrupt(); return }
                }
            }
        }

        companion object {
            private const val EMIT_BACKOFF_INITIAL_MS = 500L
            private const val EMIT_BACKOFF_CEILING_MS = 5000L
        }
    }

    fun destroy() {
        // `instance` is deliberately NOT cleared here. onHostDestroy fires when
        // the last Activity goes away, but the ReactInstance and this module
        // survive, so init{} never re-runs and nothing would ever restore it —
        // every later inbound message would be dropped for the life of the
        // process (back button to home, then reopen). It is only a gate: the
        // JNI callee ignores the receiver and routes through g_bridge, so a
        // stale instance delivers to the correct current bridge regardless.
        // Bridge teardown belongs to invalidate() below, which fires on real
        // ReactInstance teardown, not Activity death.
        try {
            Keybase.reset()
            relayReset()
        } catch (e: Exception) {
            NativeLogger.error("Exception in KeybaseEngine.destroy", e)
        }
    }

    // Fires on real ReactInstance/TurboModule teardown (reload, instance
    // recreation) — unlike onHostDestroy, which fires when the last Activity
    // dies while the ReactInstance and this module survive. This is the only
    // place that should ever clear the native bridge.
    override fun invalidate() {
        nativeInvalidate()
        super.invalidate()
    }

    // Called from JNI (cpp-adapter writeToGo), not from JS. DoNotStrip keeps it
    // from being removed/renamed by ProGuard since the only caller is reflective.
    // Returns false when the payload never reached Go, so the caller can fail
    // that RPC instead of leaving it outstanding forever.
    @DoNotStrip
    fun rpcOnGo(arr: ByteArray): Boolean {
        return try {
            writeArr(arr)
            true
        } catch (e: Exception) {
            NativeLogger.error("Exception in GoJSIBridge.rpcOnGo", e)
            false
        }
    }

    // Called from JNI when the incoming byte stream desyncs -- also true
    // since this can escalate for a msgpack->JSI conversion failure or a
    // missing rpcOnJs, arriving on the JS thread rather than the reader
    // thread. Either way recv_ still holds bytes from the now-dead
    // connection; nativeResetRecv() drops them so the next connection
    // doesn't desync on its very first frame. Resetting the Go connection
    // and relaying the meta event lets JS fail its outstanding RPCs instead
    // of waiting on a channel that can no longer deliver.
    @DoNotStrip
    fun onRpcStreamFatal() {
        NativeLogger.warn("$NAME: rpc stream desync, resetting connection")
        // Reset the Go connection before the parser: the reader thread is
        // still live on this path, so clearing the parser first would leave a
        // window where bytes from the OLD connection land in the
        // freshly-reset unpacker mid-frame, causing a second desync.
        //
        // Unconditional reset() rather than resetIfCurrent(epoch): this
        // fires from the shared C++ onFatal_ callback, a bare no-arg
        // std::function that runs off callInvoker_->invokeAsync with
        // arbitrary latency -- but no epoch is plumbed through it or through
        // onDataFromGo on either platform's read loop. Widening that would
        // touch the JNI and ObjC call sites too, not just this method. Left
        // as unconditional reset() for now; this can race a concurrent
        // re-dial the same way any unconditional reset can.
        try {
            Keybase.reset()
        } catch (e: Exception) {
            NativeLogger.error("Exception resetting after rpc desync", e)
        }
        nativeResetRecv()
        reactContext.runOnUiQueueThread { relayReset() }
    }

    // Called from the reader thread when readArr failed and Go reset the
    // connection underneath us. Unlike onRpcStreamFatal we must NOT call
    // Keybase.reset() -- ReadArr already did, and a second reset would close a
    // connection a concurrent writeArr may have just dialed.
    //
    // nativeResetRecv() runs every time regardless of `emit`: it is cheap and
    // must happen on every failed read. `emit` only throttles the
    // kb-engine-reset meta event, which the caller rate-limits with a
    // backoff -- a connection that cannot be re-dialed retries this path at
    // ~10Hz, and disconnectCallback/connectCallback on the JS side are not
    // free to re-run at that rate.
    fun onRpcConnectionReset(emit: Boolean) {
        nativeResetRecv()
        if (emit) {
            reactContext.runOnUiQueueThread { relayReset() }
        }
    }

    // Called from JNI. Routes native bridge errors into the uploadable log --
    // __android_log_print only reaches logcat, which a field log send does not
    // include.
    @DoNotStrip
    fun onNativeLog(message: String) {
        NativeLogger.error("$NAME: $message")
    }

    @ReactMethod
    override fun iosGetHasShownPushPrompt(promise: Promise) {
        promise.reject(Exception("wrong platform"))
    }

    @ReactMethod
    override fun processMedia(
        path: String,
        isVideo: Boolean,
        compress: Boolean,
        startMs: Double,
        endMs: Double,
        removeAudio: Boolean,
        promise: Promise
    ) {
        promise.reject(Exception("wrong platform"))
    }

    private fun sendHardwareKeyEvent(keyName: String) {
        if (canEmit()) {
            emitOnHardwareKeyPressed(keyName)
        }
    }

    companion object {
        init {
            System.loadLibrary("cpp")
        }

        const val NAME: String = "Kb"
        private const val RPC_META_EVENT_ENGINE_RESET: String = "kb-engine-reset"

        // Process-wide, not per-instance: a reload creates a new KbModule but
        // must not create a second reader for the one shared Go connection.
        private val readLoopStarted = AtomicBoolean(false)
        private const val MAX_TEXT_FILE_SIZE = 100 * 1024 // 100 kiB
        private val LINE_SEPARATOR: String? = System.getProperty("line.separator")

        // Written on init/destroy, read on the permanent reader thread; needs a
        // visibility guarantee so the reader never sees a stale instance.
        @Volatile
        var instance: KbModule? = null
        @JvmStatic
        internal var initialNotificationBundle: Bundle? = null

        @JvmStatic
        fun keyPressed(keyName: String) {
            instance?.sendHardwareKeyEvent(keyName)
        }

        @JvmStatic
        fun setInitialNotification(bundle: Bundle?) {
            initialNotificationBundle = bundle
        }

        @JvmStatic
        fun isReactNativeRunning(): Boolean {
            return instance != null
        }

        @JvmStatic
        fun emitPushNotification(notification: Bundle) {
            val module = instance
            if (module == null) {
                // NativeLogger writes to the Go service, which may not be up here.
                android.util.Log.w("KbModule", "emitPushNotification called but instance is null (app may not be running)")
                return
            }
            module.emitPushNotificationInternal(notification)
        }

        @JvmStatic
        fun emitShareData(data: WritableMap) {
            val module = instance
            if (module == null) {
                android.util.Log.w("KbModule", "emitShareData called but instance is null (app may not be running)")
                return
            }
            module.emitShareDataInternal(data)
        }

        // Is this a robot controlled test device? (i.e. pre-launch report?)
        private fun isTestDevice(context: ReactApplicationContext): Boolean {
            val testLabSetting: String? = Settings.System.getString(context.contentResolver, "firebase.test.lab")
            return "true".equals(testLabSetting)
        }

        private const val FILE_PREFIX_BUNDLE_ASSET: String = "bundle-assets://"
    }
}
