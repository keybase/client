package io.keybase.ossifrage

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
import android.view.View
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.content.IntentCompat
import android.webkit.MimeTypeMap
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.modules.core.PermissionListener
import com.reactnativekb.DarkModePreference
import com.reactnativekb.KbModule
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
        if (Intent.ACTION_SEND == intent.action || Intent.ACTION_SEND_MULTIPLE == intent.action) {
            normalizeShareIntent(intent)
            cachedIntent = intent
            pendingShareUris = extractSharedUris(intent).toMutableList()
            pendingShareSubject = intent.getStringExtra(Intent.EXTRA_SUBJECT)
            pendingShareText = intent.getStringExtra(Intent.EXTRA_TEXT)
        }
        val bundleFromNotification = intent.getBundleExtra("notification")
        if (bundleFromNotification != null) {
            KbModule.setInitialNotification(bundleFromNotification.clone() as Bundle)
        }

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

        scheduleHandleIntent()

        // fix for keyboard avoiding not working on 35
        if (Build.VERSION.SDK_INT >= 35) {
            val rootView = findViewById<View>(android.R.id.content)
            ViewCompat.setOnApplyWindowInsetsListener(rootView) { _, insets ->
            val innerPadding = insets.getInsets(WindowInsetsCompat.Type.ime())
            rootView.setPadding(
                innerPadding.left,
                innerPadding.top,
                innerPadding.right,
                innerPadding.bottom)
            insets
            }
        }
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
        handleIntent(requireJsListening = false)
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

    private var pendingShareUris: MutableList<Uri>? = null
    private var pendingShareSubject: String? = null
    private var pendingShareText: String? = null

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        cachedIntent = intent
        if (Intent.ACTION_SEND == intent.action || Intent.ACTION_SEND_MULTIPLE == intent.action) {
            normalizeShareIntent(intent)
            setIntent(intent)
            cachedIntent = intent
            pendingShareUris = extractSharedUris(intent).toMutableList()
            pendingShareSubject = intent.getStringExtra(Intent.EXTRA_SUBJECT)
            pendingShareText = intent.getStringExtra(Intent.EXTRA_TEXT)
        }
        val bundleFromNotification = intent.getBundleExtra("notification")
        if (bundleFromNotification != null) {
            KbModule.setInitialNotification(bundleFromNotification.clone() as Bundle)
        }
        NativeLogger.info("MainActivity.onNewIntent: action=${intent.action}, uriCount=${pendingShareUris?.size ?: 0}, hasNotification=${bundleFromNotification != null}")
    }

    private var jsIsListening = false

    public fun shareListenersRegistered() {
        jsIsListening = true
        tryHandleIntentWithRetry()
    }

    private var handledIntentHash: String? = null

    private fun normalizeShareIntent(intent: Intent) {
        val uris = extractSharedUris(intent)
        intent.removeExtra(Intent.EXTRA_STREAM)
        if (uris.isNotEmpty()) {
            intent.putParcelableArrayListExtra(Intent.EXTRA_STREAM, ArrayList(uris))
        }
    }

    private fun extractSharedUris(intent: Intent): List<Uri> {
        val action = intent.action
        if (Intent.ACTION_SEND != action && Intent.ACTION_SEND_MULTIPLE != action) {
            return emptyList()
        }

        val uris = mutableListOf<Uri>()

        intent.clipData?.let { clip ->
            for (i in 0 until clip.itemCount) {
                clip.getItemAt(i)?.uri?.let { uris.add(it) }
            }
        }

        // Avoid getParcelableArrayListExtra() here: some senders incorrectly use ACTION_SEND_MULTIPLE
        // but provide a single Uri in EXTRA_STREAM, which would cause a ClassCast log/warning.
        when (val streamExtra = intent.extras?.get(Intent.EXTRA_STREAM)) {
            is Uri -> uris.add(streamExtra)
            is ArrayList<*> -> streamExtra.filterIsInstance<Uri>().forEach { uris.add(it) }
            else -> {
            }
        }

        if (uris.isEmpty()) {
            IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java)?.let { uris.add(it) }
        }

        return uris.distinct()
    }

    private var handleIntentRetryCount = 0
    private val maxHandleIntentRetries = 20 // 20 * 500ms = 10s max

    private fun scheduleHandleIntent() {
        if (cachedIntent == null) return
        handleIntentRetryCount = 0
        tryHandleIntentWithRetry()
    }

    private fun tryHandleIntentWithRetry() {
        if (cachedIntent == null) return
        if (handleIntent()) return
        handleIntentRetryCount++
        if (handleIntentRetryCount >= maxHandleIntentRetries) {
            NativeLogger.info("MainActivity: giving up on handleIntent after $maxHandleIntentRetries retries")
            return
        }
        NativeLogger.info("MainActivity: scheduling handleIntent retry #$handleIntentRetryCount")
        Handler(Looper.getMainLooper()).postDelayed({ tryHandleIntentWithRetry() }, 500)
    }

    private fun handleIntent(requireJsListening: Boolean = true): Boolean {
        val intent = cachedIntent ?: return true
        val rc = reactActivityDelegate?.getCurrentReactContext() ?: run {
            NativeLogger.info("MainActivity.handleIntent: no react context, will retry")
            return false
        }
        val emitter = rc.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java) ?: run {
            NativeLogger.info("MainActivity.handleIntent: no emitter, will retry")
            return false
        }
        if (requireJsListening && !jsIsListening) {
            NativeLogger.info("MainActivity.handleIntent: JS not listening yet, will retry")
            return false
        }
        NativeLogger.info("MainActivity.handleIntent: processing intent action=${intent.action}")

        // Here we are just reading from the notification bundle.
        // If other sources start the app, we can get their intent data the same way.
        val bundleFromNotification = intent.getBundleExtra("notification")

        var didSomething = false

        if (bundleFromNotification != null) {
            // Prevent duplicate handling of the same notification
            val convID = bundleFromNotification.getString("convID") ?: bundleFromNotification.getString("c")
            val messageId = bundleFromNotification.getString("msgID") ?: bundleFromNotification.getString("d") ?: ""
            val intentHash = "${convID}_${messageId}"
            val shouldEmitNotification = handledIntentHash != intentHash
            if (!shouldEmitNotification) {
                NativeLogger.info("MainActivity.handleIntent skipping duplicate notification: $intentHash")
            } else {
                handledIntentHash = intentHash
                NativeLogger.info("MainActivity.handleIntent processing notification: $intentHash")

                // If there are any other bundle sources we care about, emit them here
                val bundle1 = bundleFromNotification.clone() as Bundle
                val bundle2 = bundleFromNotification.clone() as Bundle
                val payload1 = Arguments.fromBundle(bundle1)
                emitter.emit(
                    "initialIntentFromNotification",
                    payload1
                )
                val payload2 = Arguments.fromBundle(bundle2)
                emitter.emit(
                    "onPushNotification",
                    payload2
                )
                didSomething = true
            }

            intent.removeExtra("notification")
        }

        val action = intent.action
        if (Intent.ACTION_SEND == action || Intent.ACTION_SEND_MULTIPLE == action) {
            val uris = pendingShareUris?.also { pendingShareUris = null }
                ?: extractSharedUris(intent)
            val subject = pendingShareSubject?.also { pendingShareSubject = null }
                ?: intent.getStringExtra(Intent.EXTRA_SUBJECT)
            val text = pendingShareText?.also { pendingShareText = null }
                ?: intent.getStringExtra(Intent.EXTRA_TEXT)

            intent.removeExtra(Intent.EXTRA_STREAM)
            intent.removeExtra(Intent.EXTRA_SUBJECT)
            intent.removeExtra(Intent.EXTRA_TEXT)
            intent.setClipData(null)

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
            val filePaths = uris.mapNotNull { uri ->
                try {
                    readFileFromUri(rc, uri)
                } catch (e: SecurityException) {
                    null
                }
            }.toTypedArray()

            val intentType = intent.type
            val isTextMime = intentType?.startsWith("text/") == true

            if (isTextMime && textPayload.isNotEmpty()) {
                // Text-type intent (e.g. URL from Chrome): prefer text over any preview images
                val args = Arguments.createMap()
                args.putString("text", text ?: textPayload)
                emitter.emit("onShareData", args)
                didSomething = true
            } else if (filePaths.isNotEmpty()) {
                val args = Arguments.createMap()
                val lPaths = Arguments.createArray()
                for (path in filePaths) {
                    lPaths.pushString(path)
                }
                args.putArray("localPaths", lPaths)
                emitter.emit("onShareData", args)
                didSomething = true
            } else if (textPayload.isNotEmpty()) {
                // Fallback: non-text MIME but no files resolved, send text
                val args = Arguments.createMap()
                args.putString("text", textPayload)
                emitter.emit("onShareData", args)
                didSomething = true
            } else if (uris.isNotEmpty()) {
                val args = Arguments.createMap()
                args.putArray("localPaths", Arguments.createArray())
                emitter.emit("onShareData", args)
                didSomething = true
            }
        }

        cachedIntent = null
        return true
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
                KbModule.keyPressed("enter")
                return true
            }
            if (event.action == KeyEvent.ACTION_DOWN && event.isShiftPressed) {
                KbModule.keyPressed("shift-enter")
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
                    DNSNSFetcher(), VideoHelper(), mobileOsVersion, isIPad, KBInstallReferrerListener(context), isIOS, null)
        }
    }
}
