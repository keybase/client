package com.reactnativekb

import android.app.Activity
import android.app.DownloadManager
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.res.AssetFileDescriptor
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.telephony.TelephonyManager
import android.text.format.DateFormat
import android.util.Log
import android.view.Window
import android.view.WindowManager
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
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.turbomodule.core.CallInvokerHolderImpl
import com.google.android.gms.tasks.OnCompleteListener
import com.google.android.gms.tasks.Task
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
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.regex.Matcher
import java.util.regex.Pattern
import keybase.Keybase
import me.leolin.shortcutbadger.ShortcutBadger
import keybase.Keybase.readArr
import keybase.Keybase.version
import keybase.Keybase.writeArr
import com.facebook.react.common.annotations.FrameworkAPI

@OptIn(FrameworkAPI::class)
internal class KbModule(reactContext: ReactApplicationContext?) : KbSpec(reactContext) {
    private var started: Boolean? = false
    private val misTestDevice: Boolean
    private val initialIntent: HashMap<String?, String?>? = null
    private val reactContext: ReactApplicationContext
    private external fun registerNatives(jsiPtr: Long)
    private external fun installJSI(jsiPtr: Long)
    private external fun emit(jsiPtr: Long, jsInvoker: CallInvokerHolderImpl?, data: ByteArray?)
    private var executor: ExecutorService? = null
    private var jsiInstalled: Boolean? = false

    override fun getName(): String {
        return NAME
    }

    @ReactMethod
    override fun addListener(eventName: String) {
    }

    @ReactMethod
    override fun removeListeners(count: Double) {
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
            val clazz: Class<*> = Class.forName(reactContext.getPackageName() + ".BuildConfig")
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
        return GuiConfig.getInstance(reactContext.getFilesDir())?.asString()
    }


    // only old arch, uncomment
    override fun getConstants(): MutableMap<String, Any>? {
        return getTypedExportedConstants()
    }

    // newarch @Override
    override fun getTypedExportedConstants(): MutableMap<String, Any> {
        val versionCode: String = getBuildConfigValue("VERSION_CODE").toString()
        val versionName: String = getBuildConfigValue("VERSION_NAME").toString()
        var isDeviceSecure = false
        try {
            val keyguardManager: KeyguardManager = reactContext.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            isDeviceSecure = keyguardManager.isKeyguardSecure()
        } catch (e: Exception) {
            NativeLogger.warn(": Error reading keyguard secure state", e)
        }
        var serverConfig = ""
        try {
            serverConfig = ReadFileAsString.read(reactContext.getCacheDir().getAbsolutePath() + "/Keybase/keybase.app.serverConfig")
        } catch (e: Exception) {
            NativeLogger.warn(": Error reading server config", e)
        }
        var cacheDir = ""
        run {
            val dir: File? = reactContext.getCacheDir()
            if (dir != null) {
                cacheDir = dir.getAbsolutePath()
            }
        }
        var downloadDir = ""
        run {
            val dir: File? = reactContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
            if (dir != null) {
                downloadDir = dir.getAbsolutePath()
            }
        }
        val constants: MutableMap<String, Any> = HashMap()
        constants.put("androidIsDeviceSecure", isDeviceSecure)
        constants.put("androidIsTestDevice", misTestDevice)
        constants.put("appVersionCode", versionCode)
        constants.put("appVersionName", versionName)
        constants.put("darkModeSupported", false)
        constants.put("fsCacheDir", cacheDir)
        constants.put("fsDownloadDir", downloadDir)
        constants.put("guiConfig", readGuiConfig() as Any)
        constants.put("serverConfig", serverConfig)
        constants.put("uses24HourClock", DateFormat.is24HourFormat(reactContext))
        constants.put("version", version())
        return constants
    }

    // country code
    @ReactMethod
    override fun getDefaultCountryCode(promise: Promise) {
        try {
            val tm: TelephonyManager = reactContext.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
            val countryCode: String = tm.getNetworkCountryIso()
            promise.resolve(countryCode)
        } catch (e: Exception) {
            promise.reject(e)
        }
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

    // Settings
    @ReactMethod
    override fun androidOpenSettings() {
        val intent = Intent()
        intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
        val uri: Uri = Uri.fromParts("package", reactContext.getPackageName(), null)
        intent.setData(uri)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(intent)
    }

    // Screen protector
    @ReactMethod
    override fun androidSetSecureFlagSetting(setSecure: Boolean, promise: Promise) {
        val prefs: SharedPreferences = reactContext.getSharedPreferences("SecureFlag", Context.MODE_PRIVATE)
        val success: Boolean = prefs.edit().putBoolean("setSecure", setSecure).commit()
        promise.resolve(success)
        setSecureFlag()
    }

    @ReactMethod
    override fun androidGetSecureFlagSetting(promise: Promise) {
        val prefs: SharedPreferences = reactContext.getSharedPreferences("SecureFlag", Context.MODE_PRIVATE)
        val setSecure: Boolean = prefs.getBoolean("setSecure", !misTestDevice)
        promise.resolve(setSecure)
    }

     private fun setSecureFlag() {
        val prefs: SharedPreferences = reactContext.getSharedPreferences("SecureFlag", Context.MODE_PRIVATE)
        val setSecure: Boolean = prefs.getBoolean("setSecure", !misTestDevice)
        val activity: Activity? = reactContext.getCurrentActivity()
        if (activity != null) {
            activity.runOnUiThread(object : Runnable {
                @Override
                override fun run() {
                    val window: Window = activity.getWindow()
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.ICE_CREAM_SANDWICH && setSecure) {
                        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
                    } else {
                        window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                    }
                }
            })
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
            val fileUri: Uri = FileProvider.getUriForFile(reactContext, reactContext.getPackageName() + ".fileprovider", file)
            intent.putExtra(Intent.EXTRA_STREAM, fileUri)
            startSharing(intent, promise)
        } catch (ex: Exception) {
            promise.reject(Exception("Error sharing file"))
        }
    }

    private fun startSharing(intent: Intent, promise: Promise) {
        if (intent.resolveActivity(reactContext.getPackageManager()) != null) {
            val chooser: Intent = Intent.createChooser(intent, "Send to")
            // Android 5.1.1 fails `startActivity` below without this flag in the Intent.
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(chooser)
            promise.resolve(true)
        } else {
            promise.reject(Exception("Invalid chooser"))
        }
    }

    @ReactMethod
    override fun androidShareText(text: String, mimeType: String, promise: Promise) {
        val intent: Intent = Intent(Intent.ACTION_SEND).setType(mimeType)
        intent.putExtra(Intent.EXTRA_TEXT, text)
        if (intent.resolveActivity(reactContext.getPackageManager()) != null) {
            val chooser: Intent = Intent.createChooser(intent, "Send to")
            // Android 5.1.1 fails `startActivity` below without this flag in the Intent.
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(chooser)
            promise.resolve(true)
        } else {
            promise.reject(Exception("Invalid chooser"))
        }
    }

    // Push
    @ReactMethod
    override fun androidCheckPushPermissions(promise: Promise) {
        val managerCompat: NotificationManagerCompat = NotificationManagerCompat.from(reactContext)
        promise.resolve(managerCompat.areNotificationsEnabled())
    }

    @ReactMethod
    override fun androidRequestPushPermissions(promise: Promise) {
        ensureFirebase()
        androidCheckPushPermissions(promise)
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
    override fun androidGetRegistrationToken(promise: Promise) {
        ensureFirebase()
        FirebaseMessaging.getInstance().getToken()
                .addOnCompleteListener(OnCompleteListener { task ->
                        if (!task.isSuccessful()) {
                            NativeLogger.info("Fetching FCM registration token failed " + task.getException())
                            promise.reject(task.getException())
                            return@OnCompleteListener
                        }

                        // Get new FCM registration token
                        val token: String? = task.result
                        if (token == null) {
                            promise.reject(task.getException())
                            return@OnCompleteListener
                         }
                        NativeLogger.info("Got token: $token")
                        promise.resolve(token)
                    })
    }

    // Unlink
    @Throws(IOException::class)
    private fun deleteRecursive(fileOrDirectory: File) {
        if (fileOrDirectory.isDirectory()) {
            val files = fileOrDirectory.listFiles()
            if (files == null) {
                throw NullPointerException("Received null trying to list files of directory '$fileOrDirectory'")
            } else {
                for (child in files) {
                    deleteRecursive(child)
                }
            }
        }
        val result: Boolean = fileOrDirectory.delete()
        if (!result) {
            throw IOException("Failed to delete '$fileOrDirectory'")
        }
    }

    init {
        this.reactContext = reactContext!!
        misTestDevice = isTestDevice(reactContext)
        setSecureFlag()
        reactContext.addLifecycleEventListener(object : LifecycleEventListener {
            @Override
            override fun onHostResume() {
                setSecureFlag()
            }

            @Override
            override fun onHostPause() {
            }

            @Override
            override fun onHostDestroy() {
            }
        })
    }

    private fun isAsset(path: String): Boolean {
        return path.startsWith(FILE_PREFIX_BUNDLE_ASSET)
    }

    private fun normalizePath(path: String): String {
        if (!Regex("""\w+\:.*""").matches(path))
        if (path.startsWith("file://")) {
            return path.replace("file://", "")
        }
        val uri: Uri = Uri.parse(path)
        return if (path.startsWith(FILE_PREFIX_BUNDLE_ASSET)) {
            path
        } else PathResolver.getRealPathFromURI(reactContext, uri) ?: ""
    }

    @ReactMethod
    override fun androidUnlink(path: String, promise: Promise) {
        try {
            val normalizedPath = normalizePath(path)
            deleteRecursive(File(normalizedPath))
            promise.resolve(true)
        } catch (err: Exception) {
            promise.reject("EUNSPECIFIED", err.getLocalizedMessage())
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
                val fd: AssetFileDescriptor = reactContext.getAssets().openFd(name)
                stat.putString("filename", name)
                stat.putString("path", path)
                stat.putString("type", "asset")
                stat.putString("size", fd.getLength().toString())
                stat.putInt("lastModified", 0)
            } else {
                val target = File(path)
                if (!target.exists()) {
                    return null
                }
                stat.putString("filename", target.getName())
                stat.putString("path", target.getPath())
                stat.putString("type", if (target.isDirectory()) "directory" else "file")
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
            promise.reject("EUNSPECIFIED", ex.getLocalizedMessage())
        }
    }

    // Dark mode
    // Same type as DarkModePreference: 'system' | 'alwaysDark' | 'alwaysLight'
    @ReactMethod
    override fun androidAppColorSchemeChanged(prefString: String) {
        try {
            val activity: Activity? = reactContext.getCurrentActivity()
            if (activity != null) {
                val m: Method = activity.javaClass.getMethod("setBackgroundColor", DarkModePreference::class.java)
                val pref: DarkModePreference = DarkModePrefHelper.fromString(prefString)
                m.invoke(activity, pref)
            }
        } catch (ex: Exception) {
        }
    }

    // Badging
    @ReactMethod
    override fun androidSetApplicationIconBadgeNumber(badge: Double) {
        ShortcutBadger.applyCount(reactContext, badge.toInt())
    }

    // init bundles
    // This isn't related to the Go Engine, but it's a small thing that wouldn't be worth putting in
    // its own react module. That's because starting up a react module is a bit expensive and we
    // wouldn't be able to lazy load this because we need it on startup.
    @ReactMethod
    override fun androidGetInitialBundleFromNotification(promise: Promise) {
        try {
            val activity: Activity? = reactContext.getCurrentActivity()
            if (activity != null) {
                val m: Method = activity.javaClass.getMethod("getInitialBundleFromNotification")
                val initialBundleFromNotification = m.invoke(activity) as Bundle?
                if (initialBundleFromNotification != null) {
                    val map: WritableMap = Arguments.fromBundle(initialBundleFromNotification)
                    promise.resolve(map)
                    return
                }
            }
        } catch (ex: Exception) {
        }
        promise.resolve(null)
    }

    @ReactMethod
    override fun androidGetInitialShareFileUrls(promise: Promise) {
        try {
            val activity: Activity? = reactContext.getCurrentActivity()
            if (activity != null) {
                val m: Method = activity.javaClass.getMethod("getInitialShareFileUrls")
                val o = m.invoke(activity)
                if (o != null && o is Array<*>) {
                    val us = o.filterIsInstance<String>()
                    val writableArray: WritableArray = Arguments.createArray()
                    for (str in us) {
                        writableArray.pushString(str)
                    }
                    promise.resolve(writableArray)
                    return
                }
            }
        } catch (ex: Exception) {
            Log.d("ossifrageShare", "androidGetInitialShareFileUrl exception" + ex.toString())
        }
        promise.resolve("")
    }

    @ReactMethod
    override fun androidGetInitialShareText(promise: Promise) {
        try {
            val activity: Activity? = reactContext.getCurrentActivity()
            if (activity != null) {
                val m: Method = activity.javaClass.getMethod("getInitialShareText")
                val shareText = m.invoke(activity)
                if (shareText != null) {
                    promise.resolve(shareText.toString())
                    return
                }
            }
        } catch (ex: Exception) {
        }
        promise.resolve("")
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    override fun install(): Boolean {
        try {
            System.loadLibrary("cpp")
            jsiInstalled = true
            val jsi = reactContext.javaScriptContextHolder?.get()
            if (jsi != null) {
                registerNatives(jsi)
                installJSI(jsi)
            } else {
                throw Exception("No context holder")
            }
        } catch (exception: Exception) {
            NativeLogger.error("Exception in installJSI", exception)
        }
        return true;
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
    override fun engineStart() {
        NativeLogger.info("KeybaseEngine started")
        try {
            started = true
            if (executor == null) {
                val ex = Executors.newSingleThreadExecutor()
                executor = ex
                ex.execute(ReadFromKBLib(reactContext))
            }
        } catch (e: Exception) {
            NativeLogger.error("Exception in engineStart", e)
        }
    }

    // JSI
    private inner class ReadFromKBLib(reactContext: ReactApplicationContext) : Runnable {
        private val reactContext: ReactApplicationContext

        init {
            this.reactContext = reactContext
            reactContext.addLifecycleEventListener(object : LifecycleEventListener {
                @Override
                override fun onHostResume() {
                    if (executor == null) {
                        val ex = Executors.newSingleThreadExecutor()
                        executor = ex
                        ex.execute(ReadFromKBLib(reactContext))
                    }
                }

                @Override
                override fun onHostPause() {
                }

                @Override
                override fun onHostDestroy() {
                    destroy()
                }
            })
        }

        @Override
        override fun run() {
            do {
                try {
                    Thread.currentThread().setName("ReadFromKBLib")
                    val data: ByteArray = readArr()
                    if (!reactContext.hasActiveCatalystInstance()) {
                        NativeLogger.info(NAME.toString() + ": JS Bridge is dead, dropping engine message: " + data)

                    }

                    val callInvoker: CallInvokerHolderImpl = reactContext.getJSCallInvokerHolder() as CallInvokerHolderImpl
                    val jsi = reactContext.javaScriptContextHolder?.get()
                    if (jsi != null) {
                        emit(jsi, callInvoker, data)
                    } else {
                        throw Exception("No context holder")
                    }
                } catch (e: Exception) {
                    if (e.message != null && e.message.equals("Read error: EOF")) {
                        NativeLogger.info("Got EOF from read. Likely because of reset.")
                    } else {
                        NativeLogger.error("Exception in ReadFromKBLib.run", e)
                    }
                }
            } while (!Thread.currentThread().isInterrupted() && reactContext.hasActiveCatalystInstance())
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
                NativeLogger.warn(NAME.toString() + ": Executor pool didn't shut down cleanly")
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

    companion object {
        val NAME: String = "Kb"
        private val RN_NAME: String = "ReactNativeJS"
        private val RPC_META_EVENT_NAME: String = "kb-meta-engine-event"
        private val RPC_META_EVENT_ENGINE_RESET: String = "kb-engine-reset"
        private const val MAX_TEXT_FILE_SIZE = 100 * 1024 // 100 kiB
        private val LINE_SEPARATOR: String? = System.getProperty("line.separator")

        // Is this a robot controlled test device? (i.e. pre-launch report?)
        private fun isTestDevice(context: ReactApplicationContext): Boolean {
            val testLabSetting: String? = Settings.System.getString(context.contentResolver, "firebase.test.lab")
            return "true".equals(testLabSetting)
        }

        private val FILE_PREFIX_BUNDLE_ASSET: String = "bundle-assets://"

        // engine
        private fun relayReset(reactContext: ReactApplicationContext) {
            if (!reactContext.hasActiveCatalystInstance()) {
                NativeLogger.info(NAME.toString() + ": JS Bridge is dead, Can't send EOF message")
            } else {
                reactContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit(RPC_META_EVENT_NAME, RPC_META_EVENT_ENGINE_RESET)
            }
        }
    }
}
