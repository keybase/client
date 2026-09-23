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
import android.util.Log
import android.view.KeyEvent
import androidx.core.content.IntentCompat
import android.webkit.MimeTypeMap
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.reactnativekb.DarkModePreference
import com.reactnativekb.IncomingShareCache
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
        captureIntent(intent)

        // Before super.onCreate so the first frame after the splash already has the
        // right background; a delayed call here shows a white flash in dark mode.
        try {
            val gc = GuiConfig.getInstance(filesDir)
            gc?.let { setBackgroundColor(it.getDarkMode()) }
        } catch (e: Exception) {
            NativeLogger.warn("Error reading GuiConfig in onCreate", e)
        }

        super.onCreate(null)
        KeybasePushNotificationListenerService.createNotificationChannel(this)
        updateIsUsingHardwareKeyboard()
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean {
        return if (BuildConfig.DEBUG && keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
            super.onKeyUp(KeyEvent.KEYCODE_MENU, null)
        } else super.onKeyUp(keyCode, event)
    }

    override fun onPause() {
        NativeLogger.info("Activity onPause")
        super.onPause()
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

    private fun saveFileToCache(context: Context, uri: Uri, filename: String): File {
        val file = IncomingShareCache.file(context, filename)
        try {
            context.contentResolver.openInputStream(uri).use { istream ->
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

    private fun readFileFromUri(context: Context, uri: Uri?): String? {
        if (uri == null) return null
        var filePath: String?
        filePath = if (uri.scheme == "content") {
            val resolver = context.contentResolver
            val mimeType = resolver.getType(uri)
            val extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType)

            // Load the filename from the resolver.
            val filename = getFileNameFromResolver(resolver, uri, extension)

            // Now load the file itself.
            val file = saveFileToCache(context, uri, filename)
            file.path
        } else {
            uri.path
        }
        return filePath
    }

    override fun onResume() {
        NativeLogger.info("Activity onResume")
        super.onResume()
        (application as MainApplication).lifecycleReporter.onMainActivityResume()
        handleIntent()
    }

    override fun onStart() {
        NativeLogger.info("Activity onStart")
        super.onStart()
    }

    override fun onDestroy() {
        NativeLogger.info("Activity onDestroy")
        super.onDestroy()
        (application as MainApplication).lifecycleReporter.onMainActivityDestroy(isFinishing, isChangingConfigurations)
    }

    // A share or notification intent parks here until JS asks for it. Nothing else is parked:
    // deep links go through super.onNewIntent -> RCTLinkingManager, so a plain launch leaves
    // this null.
    private var cachedIntent: Intent? = null

    private var pendingShareUris: List<Uri>? = null
    private var pendingShareSubject: String? = null
    private var pendingShareText: String? = null

    // Snapshot share data out of the intent right away: share URI permission grants and clip
    // data are tied to the delivered intent, and JS may not be ready to route them until much
    // later (see shareListenersRegistered).
    private fun captureIntent(intent: Intent) {
        val bundleFromNotification = intent.getBundleExtra("notification")
        if (bundleFromNotification != null) {
            KbModule.setInitialNotification(bundleFromNotification.clone() as Bundle)
        }
        val isShare = Intent.ACTION_SEND == intent.action || Intent.ACTION_SEND_MULTIPLE == intent.action
        if (!isShare && bundleFromNotification == null) {
            return
        }
        cachedIntent = intent
        if (isShare) {
            pendingShareUris = extractSharedUris(intent)
            pendingShareSubject = intent.getStringExtra(Intent.EXTRA_SUBJECT)
            pendingShareText = intent.getStringExtra(Intent.EXTRA_TEXT)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        captureIntent(intent)
        NativeLogger.info("MainActivity.onNewIntent: action=${intent.action}, uriCount=${pendingShareUris?.size ?: 0}, hasNotification=${intent.getBundleExtra("notification") != null}")
    }

    private var jsIsListening = false

    // JS calls this once it is ready to route a share. That is the only signal the parked
    // intent waits on.
    public fun shareListenersRegistered() {
        jsIsListening = true
        handleIntent()
    }

    private var handledIntentHash: String? = null

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
        @Suppress("DEPRECATION")
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

    private fun handleIntent() {
        val intent = cachedIntent ?: return
        if (!jsIsListening) return
        NativeLogger.info("MainActivity.handleIntent: processing intent action=${intent.action}")

        // Here we are just reading from the notification bundle.
        // If other sources start the app, we can get their intent data the same way.
        val bundleFromNotification = intent.getBundleExtra("notification")

        if (bundleFromNotification != null) {
            // Prevent duplicate handling of the same notification
            val convID = bundleFromNotification.getString("convID") ?: bundleFromNotification.getString("c")
            val messageId = bundleFromNotification.getString("msgID") ?: bundleFromNotification.getString("d") ?: ""
            val intentHash = "${convID}_${messageId}"
            if (handledIntentHash == intentHash) {
                NativeLogger.info("MainActivity.handleIntent skipping duplicate notification: $intentHash")
            } else {
                handledIntentHash = intentHash
                NativeLogger.info("MainActivity.handleIntent processing notification: $intentHash")

                KbModule.emitPushNotification(bundleFromNotification)
            }

            intent.removeExtra("notification")
        }

        val action = intent.action
        if (Intent.ACTION_SEND == action || Intent.ACTION_SEND_MULTIPLE == action) {
            val uris = pendingShareUris.orEmpty().also { pendingShareUris = null }
            val subject = pendingShareSubject.also { pendingShareSubject = null }
            val text = pendingShareText.also { pendingShareText = null }

            // Strip consumed extras so an activity recreation (which redelivers this
            // same intent instance) doesn't re-share.
            intent.removeExtra(Intent.EXTRA_STREAM)
            intent.removeExtra(Intent.EXTRA_SUBJECT)
            intent.removeExtra(Intent.EXTRA_TEXT)
            intent.setClipData(null)

            val textPayload = listOfNotNull(subject, text).joinToString(" ")
            val isTextMime = intent.type?.startsWith("text/") == true

            if (isTextMime && textPayload.isNotEmpty()) {
                // Text-type intent (e.g. URL from Chrome): prefer text over any preview images
                emitShareText(text ?: textPayload)
            } else if (uris.isEmpty()) {
                if (textPayload.isNotEmpty()) {
                    emitShareText(textPayload)
                }
            } else {
                // Copying out of the content providers can be slow for big files; don't
                // block the main thread on it.
                val context: Context = this
                Thread {
                    val filePaths = uris.mapNotNull { uri ->
                        try {
                            readFileFromUri(context, uri)
                        } catch (e: SecurityException) {
                            null
                        }
                    }
                    if (filePaths.isNotEmpty()) {
                        emitShareFiles(filePaths)
                    } else if (textPayload.isNotEmpty()) {
                        // Fallback: non-text MIME but no files resolved, send text
                        emitShareText(textPayload)
                    } else {
                        emitShareFiles(emptyList())
                    }
                }.start()
            }
        }

        cachedIntent = null
    }

    private fun emitShareText(text: String) {
        val args = Arguments.createMap()
        args.putString("text", text)
        KbModule.emitShareData(args)
    }

    private fun emitShareFiles(paths: List<String>) {
        val args = Arguments.createMap()
        val lPaths = Arguments.createArray()
        for (path in paths) {
            lPaths.pushString(path)
        }
        args.putArray("localPaths", lPaths)
        KbModule.emitShareData(args)
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
            val gc = GuiConfig.getInstance(filesDir)
            gc?.let { setBackgroundColor(it.getDarkMode()) }
        } catch (e: Exception) {
            NativeLogger.warn("Error reading GuiConfig in onConfigurationChanged", e)
        }
        if (newConfig.hardKeyboardHidden == Configuration.HARDKEYBOARDHIDDEN_NO) {
            isUsingHardwareKeyboard = true
        } else if (newConfig.hardKeyboardHidden == Configuration.HARDKEYBOARDHIDDEN_YES) {
            isUsingHardwareKeyboard = false
        }
    }

    fun setBackgroundColor(pref: DarkModePreference) {
        val bgColor = when (pref) {
            DarkModePreference.System -> {
                if (colorSchemeForCurrentConfiguration() == "light") R.color.white else R.color.black
            }
            DarkModePreference.AlwaysDark -> R.color.black
            DarkModePreference.AlwaysLight -> R.color.white
        }
        val mainWindow = this.window
        if (Looper.myLooper() == Looper.getMainLooper()) {
            mainWindow.setBackgroundDrawableResource(bgColor)
        } else {
            Handler(Looper.getMainLooper()).post { mainWindow.setBackgroundDrawableResource(bgColor) }
        }
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
