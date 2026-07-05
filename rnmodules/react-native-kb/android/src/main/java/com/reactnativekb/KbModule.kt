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
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
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

    private var executor: ExecutorService? = null
    private var lifecycleListenerRegistered = false

    override fun getName(): String {
        return NAME
    }

    @ReactMethod
    override fun addListener(eventName: String) {
    }

    @ReactMethod
    override fun removeListeners(count: Double) {
    }

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
        val guiConfig: String?,
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
            guiConfig = readGuiConfig(),
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
        constants.putBoolean("darkModeSupported", false)
        constants.putString("fsCacheDir", c.cacheDir)
        constants.putString("fsDownloadDir", c.downloadDir)
        constants.putString("guiConfig", c.guiConfig)
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
        instance = this
        misTestDevice = isTestDevice(reactContext)
        Thread { cachedConstants }.start()
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
        if (reactContext.hasActiveReactInstance()) {
            try {
                val payload = Arguments.fromBundle(notification)
                reactContext.emitDeviceEvent("onPushNotification", payload)
            } catch (e: Exception) {
                NativeLogger.error("emitPushNotificationInternal failed to emit: " + e.message)
            }
        } else {
            NativeLogger.warn("emitPushNotificationInternal no active react instance")
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

    @ReactMethod
    override fun engineReset() {
        try {
            Keybase.reset()
            relayReset(reactContext)
        } catch (e: Exception) {
            NativeLogger.error("Exception in engineReset", e)
        }
    }

    @ReactMethod
    override fun notifyJSReady() {
        NativeLogger.info("JS signaled ready, starting ReadFromKBLib loop")
        try {
            // Signal to Go that JS is ready
            Keybase.notifyJSReady()

            startReadLoop()

            // Register once; restart the read loop on resume, tear down on destroy.
            if (!lifecycleListenerRegistered) {
                lifecycleListenerRegistered = true
                reactContext.addLifecycleEventListener(object : LifecycleEventListener {
                    override fun onHostResume() {
                        startReadLoop()
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

    private fun startReadLoop() {
        if (executor == null) {
            val ex = Executors.newSingleThreadExecutor()
            executor = ex
            ex.execute(ReadFromKBLib(reactContext))
        }
    }

    // JSI
    private inner class ReadFromKBLib(private val reactContext: ReactApplicationContext) : Runnable {
        override fun run() {
            do {
                try {
                    Thread.currentThread().name = "ReadFromKBLib"
                    val data: ByteArray = readArr()
                    if (!reactContext.hasActiveReactInstance()) {
                        NativeLogger.info("$NAME: JS Bridge is dead, dropping engine message")
                        continue
                    }
                    nativeOnDataFromGo(data)
                } catch (e: Exception) {
                    if (e.message != null && e.message.equals("Read error: EOF")) {
                        NativeLogger.info("Got EOF from read. Likely because of reset.")
                    } else {
                        NativeLogger.error("Exception in ReadFromKBLib.run", e)
                    }
                    // Back off on error to avoid spinning at full CPU speed when Go is
                    // unavailable (e.g. during init or loopback restart).
                    try { Thread.sleep(100) } catch (ie: InterruptedException) { Thread.currentThread().interrupt() }
                }
            } while (!Thread.currentThread().isInterrupted && reactContext.hasActiveReactInstance())
        }
    }

    fun destroy() {
        try {
            Keybase.reset()
            relayReset(reactContext)
        } catch (e: Exception) {
            NativeLogger.error("Exception in KeybaseEngine.destroy", e)
        }
        try {
            executor?.shutdownNow()

            // We often hit this timeout during app resume, e.g. hit the back
            // button to go to home screen and then tap Keybase app icon again.
            if (executor?.awaitTermination(3, TimeUnit.SECONDS)== false) {
                NativeLogger.warn("$NAME: Executor pool didn't shut down cleanly")
            }
            executor = null
        } catch (e: Exception) {
            NativeLogger.error("Exception in JSI.destroy", e)
        }
    }

    // Called from JNI (cpp-adapter writeToGo), not from JS. DoNotStrip keeps it
    // from being removed/renamed by ProGuard since the only caller is reflective.
    @DoNotStrip
    fun rpcOnGo(arr: ByteArray) {
        try {
            writeArr(arr)
        } catch (e: Exception) {
            NativeLogger.error("Exception in GoJSIBridge.rpcOnGo", e)
        }
    }

    @ReactMethod
    override fun iosGetHasShownPushPrompt(promise: Promise) {
        promise.reject(Exception("wrong platform"))
    }

    private fun sendHardwareKeyEvent(keyName: String) {
        val params = Arguments.createMap()
        params.putString("pressedKey", keyName)
        reactContext.emitDeviceEvent(HW_KEY_EVENT, params)
    }

    companion object {
        init {
            System.loadLibrary("cpp")
        }

        const val NAME: String = "Kb"
        private const val RPC_META_EVENT_NAME: String = "kb-meta-engine-event"
        private const val RPC_META_EVENT_ENGINE_RESET: String = "kb-engine-reset"
        private const val MAX_TEXT_FILE_SIZE = 100 * 1024 // 100 kiB
        private val LINE_SEPARATOR: String? = System.getProperty("line.separator")
        private const val HW_KEY_EVENT: String = "hardwareKeyPressed"

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

        // Is this a robot controlled test device? (i.e. pre-launch report?)
        private fun isTestDevice(context: ReactApplicationContext): Boolean {
            val testLabSetting: String? = Settings.System.getString(context.contentResolver, "firebase.test.lab")
            return "true".equals(testLabSetting)
        }

        private const val FILE_PREFIX_BUNDLE_ASSET: String = "bundle-assets://"

        // engine
        private fun relayReset(reactContext: ReactApplicationContext) {
            if (!reactContext.hasActiveReactInstance()) {
                NativeLogger.info("$NAME: JS Bridge is dead, Can't send EOF message")
            } else {
                reactContext.emitDeviceEvent(RPC_META_EVENT_NAME, RPC_META_EVENT_ENGINE_RESET)
            }
        }
    }
}
