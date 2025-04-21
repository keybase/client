package io.keybase.ossifrage

import android.annotation.TargetApi
import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.provider.Settings
import android.util.Log
import android.view.KeyEvent
import android.webkit.MimeTypeMap
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactApplication
import com.facebook.react.ReactInstanceManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter
import com.facebook.react.modules.core.PermissionListener
import com.github.emilioicai.hwkeyboardevent.HWKeyboardEventModule
import com.reactnativekb.DarkModePreference
import com.reactnativekb.GuiConfig
import io.keybase.ossifrage.modules.NativeLogger
import io.keybase.ossifrage.util.DNSNSFetcher
import io.keybase.ossifrage.util.VideoHelper
import keybase.Keybase
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.security.KeyStoreException
import java.security.NoSuchAlgorithmException
import java.security.cert.CertificateException
import java.util.UUID

class MainActivity : ReactActivity() {
    private val listener: PermissionListener? = null
    private var isUsingHardwareKeyboard = false

    override fun invokeDefaultOnBackPressed() {
        moveTaskToBack(true)
    }

    private val reactContext: ReactContext?
         get() {
        val reactHost = (application as ReactApplication).reactNativeHost
        val reactInstanceManager = reactHost.reactInstanceManager
            val currentContext = reactInstanceManager.currentReactContext
            return currentContext
        }

    private fun colorSchemeForCurrentConfiguration(): String {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val currentNightMode = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
            when (currentNightMode) {
                Configuration.UI_MODE_NIGHT_NO -> return "light"
                Configuration.UI_MODE_NIGHT_YES -> return "dark"
            }
        }
        return "light"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        NativeLogger.info("Activity onCreate")
        setupKBRuntime(this, true)
        cachedIntent = intent

        super.onCreate(null)
        Handler(Looper.getMainLooper()).postDelayed({
            try {
                var gc = GuiConfig.getInstance(filesDir)
                if (gc != null) {
                    setBackgroundColor(gc.getDarkMode())
                }
            } catch (e: Exception) {
            }
        }, 300)
        KeybasePushNotificationListenerService.createNotificationChannel(this)
        updateIsUsingHardwareKeyboard()

        // old arch, hook up react starting up new arch does this by itself i think
        val reactHost = (application as ReactApplication).reactNativeHost
        val reactInstanceManager = reactHost.reactInstanceManager
        if (reactInstanceManager.hasStartedCreatingInitialContext()) {
            val currentContext = reactInstanceManager.currentReactContext
            if (currentContext != null) {
        handleIntent()
                return
            }
        }
        val listener = object : ReactInstanceManager.ReactInstanceEventListener {
            override fun onReactContextInitialized(c: ReactContext) {
        handleIntent()
                reactInstanceManager.removeReactInstanceEventListener(this)
            }
        }
        reactInstanceManager.addReactInstanceEventListener(listener)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean {
        return if (BuildConfig.DEBUG && keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
            super.onKeyUp(KeyEvent.KEYCODE_MENU, null)
        } else super.onKeyUp(keyCode, event)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        listener?.onRequestPermissionsResult(requestCode, permissions, grantResults)
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    }

    override fun onPause() {
        NativeLogger.info("Activity onPause")
        super.onPause()
        if (Keybase.appDidEnterBackground()) {
            Keybase.appBeginBackgroundTaskNonblock(KBPushNotifier(this, Bundle()))
        } else {
            Keybase.setAppStateBackground()
        }
    }

    private fun getFileNameFromResolver(resolver: ContentResolver, uri: Uri, extension: String?): String {
        // Use a GUID default.
        var filename = String.format("%s.%s", UUID.randomUUID().toString(), extension)
        val nameProjection = arrayOf(MediaStore.MediaColumns.DISPLAY_NAME)
        resolver.query(uri, nameProjection, null, null, null).use { cursor ->
            if (cursor != null && cursor.moveToFirst()) {
                filename = cursor.getString(0)
            }
        }
        val cut = filename.lastIndexOf('/')
        if (cut != -1) {
            filename = filename.substring(cut + 1)
        }
        return filename
    }

    private fun saveFileToCache(reactContext: ReactContext?, uri: Uri, filename: String): File {
        val file = File(reactContext!!.cacheDir, filename)
        try {
            reactContext.contentResolver.openInputStream(uri).use { istream ->
                FileOutputStream(file).use { ostream ->
                    val buf = ByteArray(64 * 1024)
                    var len: Int
                    while (istream!!.read(buf).also { len = it } != -1) {
                        ostream.write(buf, 0, len)
                    }
                }
            }
        } catch (ex: IOException) {
            Log.w(TAG, "Error writing shared file $uri", ex)
        }
        return file
    }

    private fun readFileFromUri(reactContext: ReactContext?, uri: Uri?): String? {
        if (uri == null) return null
        var filePath: String?
        filePath = if (uri.scheme == "content") {
            val resolver = reactContext!!.contentResolver
            val mimeType = resolver.getType(uri)
            val extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType)

            // Load the filename from the resolver.
            val filename = getFileNameFromResolver(resolver, uri, extension)

            // Now load the file itself.
            val file = saveFileToCache(reactContext, uri, filename)
            file.path
        } else {
            uri.path
        }
        return filePath
    }

    override fun onResume() {
        NativeLogger.info("Activity onResume")
        super.onResume()
        Keybase.setAppStateForeground()
    }

    override fun onStart() {
        NativeLogger.info("Activity onStart")
        super.onStart()
        Keybase.setAppStateForeground()
    }

    override fun onDestroy() {
        NativeLogger.info("Activity onDestroy")
        super.onDestroy()
        Keybase.appWillExit(KBPushNotifier(this, Bundle()))
    }

    private var cachedIntent: Intent? = null

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        cachedIntent = intent
        handleIntent()
    }

    public fun shareListenersRegistered() {
        jsIsListening  = true
        handleIntent()
    }

    private var jsIsListening = false
    private fun handleIntent() {
        val intent = cachedIntent ?: return
        var rc = reactContext ?: return
        val emitter = rc.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java) ?: return

        if (jsIsListening == false) {
            return
        }
        cachedIntent = null

        // Here we are just reading from the notification bundle.
        // If other sources start the app, we can get their intent data the same way.
        val bundleFromNotification = intent.getBundleExtra("notification")
        intent.removeExtra("notification")
        val action = intent.action
        var uris_: Array<Uri?>? = null
        if (Intent.ACTION_SEND_MULTIPLE == action) {
            val alUri = intent.getParcelableArrayListExtra<Uri?>(Intent.EXTRA_STREAM)
            uris_ = alUri!!.toTypedArray<Uri?>()
        } else if (Intent.ACTION_SEND == action) {
            val oneUri = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
            uris_ = arrayOf(oneUri)
        }
        intent.removeExtra(Intent.EXTRA_STREAM)
        val uris = uris_
        val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)
        intent.removeExtra(Intent.EXTRA_SUBJECT)
        val text = intent.getStringExtra(Intent.EXTRA_TEXT)
        intent.removeExtra(Intent.EXTRA_TEXT)
        val sb = StringBuilder()
        if (subject != null) {
            sb.append(subject)
        }
        if (subject != null && text != null) {
            sb.append(" ")
        }
        if (text != null) {
            sb.append(text)
        }

        val textPayload = sb.toString()

        val filePaths = uris?.mapNotNull { uri ->
            readFileFromUri(rc, uri)
        }?.toTypedArray() ?: emptyArray()

        // If there are any other bundle sources we care about, emit them here
        if (bundleFromNotification != null) {
            var payload = Arguments.fromBundle(bundleFromNotification)
            emitter.emit(
                "initialIntentFromNotification",
                payload
            )
        }
        if (filePaths.size != 0) {
            val args = Arguments.createMap()
            val lPaths = Arguments.createArray()
            for (path in filePaths) {
                lPaths.pushString(path)
            }
            args.putArray("localPaths", lPaths)
            emitter.emit("onShareData", args)
        } else if (textPayload.length > 0) {
            val args = Arguments.createMap()
            args.putString("text", textPayload)
            emitter.emit("onShareData", args)
        }
    }

    override fun getMainComponentName(): String = "Keybase"

    override fun createReactActivityDelegate(): ReactActivityDelegate {
        return DefaultReactActivityDelegate(
                this,
                mainComponentName,  // If you opted-in for the New Architecture, we enable the Fabric Renderer.
                fabricEnabled
        )
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        try {
            var gc = GuiConfig.getInstance(filesDir)
            if (gc != null) {
                setBackgroundColor(gc.getDarkMode())
            }
        } catch (e: Exception) {
        }
        if (newConfig.hardKeyboardHidden == Configuration.HARDKEYBOARDHIDDEN_NO) {
            isUsingHardwareKeyboard = true
        } else if (newConfig.hardKeyboardHidden == Configuration.HARDKEYBOARDHIDDEN_YES) {
            isUsingHardwareKeyboard = false
        }
    }

    fun setBackgroundColor(pref: DarkModePreference) {
        val bgColor: Int
        bgColor = if (pref == DarkModePreference.System) {
            if (colorSchemeForCurrentConfiguration() == "light") R.color.white else R.color.black
        } else if (pref == DarkModePreference.AlwaysDark) {
            R.color.black
        } else {
            R.color.white
        }
        val mainWindow = this.window
        val handler = Handler(Looper.getMainLooper())
        // Run this on the main thread.
        handler.post { mainWindow.setBackgroundDrawableResource(bgColor) }
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (isUsingHardwareKeyboard && event.keyCode == KeyEvent.KEYCODE_ENTER) {
            // Detects user pressing the enter key
            if (event.action == KeyEvent.ACTION_DOWN && !event.isShiftPressed) {
                // Enter is pressed
                HWKeyboardEventModule.getInstance().keyPressed("enter")
                return true
            }
            if (event.action == KeyEvent.ACTION_DOWN && event.isShiftPressed) {
                // Shift-Enter is pressed
                HWKeyboardEventModule.getInstance().keyPressed("shift-enter")
                return true
            }
        }
        return super.dispatchKeyEvent(event)
    }

    private fun updateIsUsingHardwareKeyboard() {
        isUsingHardwareKeyboard = resources.configuration.keyboard == Configuration.KEYBOARD_QWERTY
    }

    companion object {
        private const val TAG = "ossifrage"
        private fun createDummyFile(context: Context) {
            val dummyFile = File(context.filesDir, "dummy.txt")
            try {
                if (dummyFile.createNewFile()) {
                    dummyFile.setWritable(true)
                    FileOutputStream(dummyFile).use { stream -> stream.write("hi".toByteArray()) }
                } else {
                    Log.d(TAG, "dummy.txt exists")
                }
            } catch (e: Exception) {
                NativeLogger.error("Exception in createDummyFile", e)
            }
        }

        // Is this a robot controlled test device? (i.e. pre-launch report?)
        fun isTestDevice(context: Context): Boolean {
            val testLabSetting = Settings.System.getString(context.contentResolver, "firebase.test.lab")
            return "true" == testLabSetting
        }

        @JvmStatic
        fun setupKBRuntime(context: Context, shouldCreateDummyFile: Boolean) {
            try {
                Keybase.setGlobalExternalKeyStore(KeyStore(context, context.getSharedPreferences("KeyStore", MODE_PRIVATE)))
            } catch (e: KeyStoreException) {
                NativeLogger.error("Exception in MainActivity.onCreate", e)
            } catch (e: CertificateException) {
                NativeLogger.error("Exception in MainActivity.onCreate", e)
            } catch (e: IOException) {
                NativeLogger.error("Exception in MainActivity.onCreate", e)
            } catch (e: NoSuchAlgorithmException) {
                NativeLogger.error("Exception in MainActivity.onCreate", e)
            }
            if (shouldCreateDummyFile) {
                createDummyFile(context)
            }
            val mobileOsVersion = Integer.toString(Build.VERSION.SDK_INT)
            val isIPad = false
            val isIOS = false
            Keybase.initOnce(context.filesDir.path, "", context.getFileStreamPath("service.log").absolutePath, "prod", false,
                    DNSNSFetcher(), VideoHelper(), mobileOsVersion, isIPad, KBInstallReferrerListener(context), isIOS)
        }
    }
}
