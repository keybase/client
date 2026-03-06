package com.reactnativekb

import android.app.Activity
import android.app.DownloadManager
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.content.res.AssetFileDescriptor
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.format.DateFormat
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.turbomodule.core.interfaces.TurboModuleWithJSIBindings
import com.facebook.react.turbomodule.core.interfaces.BindingsInstallerHolder
import com.facebook.proguard.annotations.DoNotStrip
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import java.io.BufferedReader
import java.io.File
import java.io.FileNotFoundException
import java.io.FileReader
import java.io.IOException
import java.io.InputStreamReader
import java.lang.reflect.Field
import java.lang.reflect.Method
import java.util.HashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import keybase.Keybase
import me.leolin.shortcutbadger.ShortcutBadger
import keybase.Keybase.readArr
import keybase.Keybase.version
import keybase.Keybase.writeArr
import android.media.MediaMetadataRetriever
import androidx.media3.transformer.TransformationRequest
import androidx.media3.transformer.Transformer
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.effect.ScaleAndRotateTransformation
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.transformer.Transformer.Listener
import androidx.media3.transformer.Composition
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.VideoEncoderSettings
import androidx.media3.transformer.DefaultEncoderFactory
import java.nio.ByteBuffer
import kotlin.math.min

class KbModule(reactContext: ReactApplicationContext?) : KbSpec(reactContext), TurboModuleWithJSIBindings {
    private val misTestDevice: Boolean
    private val initialIntent: HashMap<String?, String?>? = null
    private val reactContext: ReactApplicationContext

    @DoNotStrip
    external override fun getBindingsInstaller(): BindingsInstallerHolder
    private external fun nativeOnDataFromGo(data: ByteArray)

    private var executor: ExecutorService? = null

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

    private fun calculateOutputDimensions(width: Int, height: Int, maxPixels: Int): Pair<Int, Int> {
        val pixelCount = width * height
        if (pixelCount <= maxPixels) {
            return Pair(width, height)
        }

        val scale = kotlin.math.sqrt(maxPixels.toDouble() / pixelCount)
        val newWidth = (width * scale).toInt().let { if (it % 2 == 0) it else it - 1 }
        val newHeight = (height * scale).toInt().let { if (it % 2 == 0) it else it - 1 }
        return Pair(newWidth, newHeight)
    }

    private fun calculateBitrate(width: Int, height: Int): Int {
        val pixelCount = width * height
        return when {
            pixelCount > 1920 * 1080 -> 8000000 // 8 Mbps for > 1080p
            pixelCount > 1280 * 720 -> 5000000  // 5 Mbps for 1080p
            else -> 3000000 // 3 Mbps for 720p and below
        }
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

    @ReactMethod(isBlockingSynchronousMethod = true)
    override fun getTypedConstants(): WritableMap {
        val versionCode: String = getBuildConfigValue("VERSION_CODE").toString()
        val versionName: String = getBuildConfigValue("VERSION_NAME").toString()
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
        var cacheDir = ""
        run {
            val dir: File? = reactContext.cacheDir
            if (dir != null) {
                cacheDir = dir.absolutePath
            }
        }
        var downloadDir = ""
        run {
            val dir: File? = reactContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
            if (dir != null) {
                downloadDir = dir.absolutePath
            }
        }

        val constants: WritableMap = Arguments.createMap()
        constants.putBoolean("androidIsDeviceSecure", isDeviceSecure)
        constants.putBoolean("androidIsTestDevice", misTestDevice)
        constants.putString("appVersionCode", versionCode)
        constants.putString("appVersionName", versionName)
        constants.putBoolean("darkModeSupported", false)
        constants.putString("fsCacheDir", cacheDir)
        constants.putString("fsDownloadDir", downloadDir)
        constants.putString("guiConfig", readGuiConfig())
        constants.putString("serverConfig", serverConfig)
        constants.putBoolean("uses24HourClock", DateFormat.is24HourFormat(reactContext))
        constants.putString("version", version())
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
    }

    private fun isAsset(path: String): Boolean {
        return path.startsWith(FILE_PREFIX_BUNDLE_ASSET)
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

    // download
    private fun statFile(_path: String): WritableMap? {
        var path  = _path
        return try {
            path = normalizePath(path)
            val stat: WritableMap = Arguments.createMap()
            if (isAsset(path)) {
                val name: String = path.replace(FILE_PREFIX_BUNDLE_ASSET, "")
                val fd: AssetFileDescriptor = reactContext.assets.openFd(name)
                stat.putString("filename", name)
                stat.putString("path", path)
                stat.putString("type", "asset")
                stat.putString("size", fd.length.toString())
                stat.putInt("lastModified", 0)
            } else {
                val target = File(path)
                if (!target.exists()) {
                    return null
                }
                stat.putString("filename", target.name)
                stat.putString("path", target.path)
                stat.putString("type", if (target.isDirectory) "directory" else "file")
                stat.putString("size", target.length().toString())
                val lastModified: String = target.lastModified().toString()
                stat.putString("lastModified", lastModified)
            }
            stat
        } catch (err: Exception) {
            null
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
            val stat: WritableMap? = statFile(path)
            var size = 0L
            if (stat != null) {
                val sizeStr = stat.getString("size")
                if (sizeStr != null) {
                    size = sizeStr.toLong()
                }
            }
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
        ShortcutBadger.applyCount(reactContext, badge.toInt())
    }

    @ReactMethod
    override fun getInitialNotification(promise: Promise) {
        val bundle = KbModule.initialNotificationBundle
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
        android.util.Log.d("KbModule", "emitPushNotificationInternal called")
        if (reactContext.hasActiveReactInstance()) {
            android.util.Log.d("KbModule", "emitPushNotificationInternal has active react instance, emitting event")
            try {
                val payload = Arguments.fromBundle(notification)
                reactContext.emitDeviceEvent("onPushNotification", payload)
                android.util.Log.d("KbModule", "emitPushNotificationInternal event emitted successfully")
            } catch (e: Exception) {
                android.util.Log.e("KbModule", "emitPushNotificationInternal failed to emit: " + e.message)
            }
        } else {
            android.util.Log.w("KbModule", "emitPushNotificationInternal no active react instance")
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

    @ReactMethod(isBlockingSynchronousMethod = true)
    override fun install(): Boolean {
        // No-op: JSI bindings are now installed via TurboModuleWithJSIBindings.getBindingsInstaller()
        return true
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

            // Start the executor to read from Go
            if (executor == null) {
                val ex = Executors.newSingleThreadExecutor()
                executor = ex
                ex.execute(ReadFromKBLib(reactContext))
            }
        } catch (e: Exception) {
            NativeLogger.error("Exception in notifyJSReady", e)
        }
    }

    // JSI
    private inner class ReadFromKBLib(reactContext: ReactApplicationContext) : Runnable {
        private val reactContext: ReactApplicationContext

        init {
            this.reactContext = reactContext
            reactContext.addLifecycleEventListener(object : LifecycleEventListener {
                override fun onHostResume() {
                    if (executor == null) {
                        val ex = Executors.newSingleThreadExecutor()
                        executor = ex
                        ex.execute(ReadFromKBLib(reactContext))
                    }
                }

                override fun onHostPause() {
                }

                override fun onHostDestroy() {
                    destroy()
                }
            })
        }

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

    @ReactMethod
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
        private const val RN_NAME: String = "ReactNativeJS"
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
            if (instance == null) {
                android.util.Log.w("KbModule", "emitPushNotification called but instance is null (app may not be running)")
                return
            }
            android.util.Log.d("KbModule", "emitPushNotification called, instance exists")
            instance?.emitPushNotificationInternal(notification)
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
