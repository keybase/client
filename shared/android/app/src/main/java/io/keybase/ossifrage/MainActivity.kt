package io.keybase.ossifrage

import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import android.util.Log
import android.view.KeyEvent
import androidx.core.content.IntentCompat
import androidx.core.text.HtmlCompat
import android.webkit.MimeTypeMap
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.bridge.Arguments
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.reactnativekb.IncomingShareCache
import com.reactnativekb.IncomingShareFileName
import com.reactnativekb.KbModule
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

class MainActivity : ReactActivity() {
    private var isUsingHardwareKeyboard = false

    override fun invokeDefaultOnBackPressed() {
        moveTaskToBack(true)
    }

    // resources.configuration carries AppCompat's night-mode override (set from the persisted
    // pref in MainApplication, then by Appearance.setColorScheme), so this matches the pref.
    private fun isNightForCurrentConfiguration(): Boolean =
        (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

    override fun onCreate(savedInstanceState: Bundle?) {
        NativeLogger.info("Activity onCreate")
        setupKBRuntime(this, true)
        captureIntent(intent)

        // Before super.onCreate so the first frame after the splash already has the
        // right background; a delayed call here shows a white flash in dark mode.
        updateWindowBackground()

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

    private fun queryDisplayName(resolver: ContentResolver, uri: Uri): String? = try {
        resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst() && !cursor.isNull(0)) cursor.getString(0) else null
        }
    } catch (e: Exception) {
        // Some providers lack the column or throw on query; the name is optional.
        NativeLogger.warn("Unable to read the display name of $uri", e)
        null
    }

    // Copies a shared item into the share cache. Returns null, leaving nothing
    // behind, when the item can't be copied whole: a missing or partial file
    // must never be sent.
    private fun copySharedUri(context: Context, uri: Uri): String? {
        if (uri.scheme != "content") {
            return uri.path
        }
        val resolver = context.contentResolver
        var file: File? = null
        return try {
            val ext = resolver.getType(uri)?.let { MimeTypeMap.getSingleton().getExtensionFromMimeType(it) }
            val dest = IncomingShareCache.newItemFile(context, IncomingShareFileName.make(queryDisplayName(resolver, uri), ext))
            file = dest
            val input = resolver.openInputStream(uri) ?: throw IOException("no stream for $uri")
            input.use { istream ->
                FileOutputStream(dest).use { ostream -> istream.copyTo(ostream, 64 * 1024) }
            }
            dest.path
        } catch (e: Exception) {
            NativeLogger.warn("Unable to copy shared item $uri", e)
            file?.let { IncomingShareCache.discardItem(context, it) }
            null
        }
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

    // A share intent parks here until JS asks for it. Nothing else is parked: deep links go
    // through super.onNewIntent -> RCTLinkingManager, and a notification tap goes through
    // PushTapActivity to KbModule, so a plain launch leaves this null.
    private var cachedIntent: Intent? = null

    private var pendingShareUris: List<Uri>? = null
    private var pendingShareSubject: String? = null
    private var pendingShareText: String? = null

    // Snapshot share data out of the intent right away: share URI permission grants and clip
    // data are tied to the delivered intent, and JS may not be ready to route them until much
    // later (see shareListenersRegistered).
    private fun captureIntent(intent: Intent) {
        if (Intent.ACTION_SEND != intent.action && Intent.ACTION_SEND_MULTIPLE != intent.action) {
            return
        }
        cachedIntent = intent
        pendingShareUris = extractSharedUris(intent)
        pendingShareSubject = sharedText(intent, Intent.EXTRA_SUBJECT)
        pendingShareText = sharedText(intent, Intent.EXTRA_TEXT)
            ?: sharedText(intent, Intent.EXTRA_HTML_TEXT)?.let {
                HtmlCompat.fromHtml(it, HtmlCompat.FROM_HTML_MODE_LEGACY).toString().takeIf { t -> t.isNotBlank() }
            }
    }

    // EXTRA_TEXT is a CharSequence, often a Spanned from rich-text senders, and an
    // ArrayList of them for SEND_MULTIPLE; getStringExtra returns null for both.
    // Blank text is no share at all.
    private fun sharedText(intent: Intent, key: String): String? {
        @Suppress("DEPRECATION")
        val text = when (val extra = intent.extras?.get(key)) {
            is CharSequence -> extra.toString()
            is ArrayList<*> -> extra.filterIsInstance<CharSequence>().joinToString("\n")
            else -> null
        }
        return text?.takeIf { it.isNotBlank() }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        captureIntent(intent)
        NativeLogger.info("MainActivity.onNewIntent: action=${intent.action}, uriCount=${pendingShareUris?.size ?: 0}")
    }

    private var jsIsListening = false

    // JS calls this once it is ready to route a share. That is the only signal the parked
    // intent waits on.
    public fun shareListenersRegistered() {
        jsIsListening = true
        handleIntent()
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
            } else {
                NativeLogger.warn("MainActivity.handleIntent: share had no text or files, type=${intent.type}")
            }
        } else {
            // Copying out of the content providers can be slow for big files; don't
            // block the main thread on it.
            val context: Context = this
            Thread {
                val filePaths = uris.mapNotNull { uri -> copySharedUri(context, uri) }
                val droppedCount = uris.size - filePaths.size
                if (filePaths.isNotEmpty()) {
                    emitShareFiles(filePaths, droppedCount)
                } else if (textPayload.isNotEmpty()) {
                    // Fallback: non-text MIME but no files resolved, send text
                    emitShareText(textPayload, droppedCount)
                } else {
                    emitShareFiles(emptyList(), droppedCount)
                }
            }.start()
        }

        cachedIntent = null
    }

    private fun emitShareText(text: String, droppedCount: Int = 0) {
        val args = Arguments.createMap()
        args.putString("text", text)
        args.putInt("droppedCount", droppedCount)
        KbModule.emitShareData(args)
    }

    // droppedCount is how many shared items couldn't be copied.
    private fun emitShareFiles(paths: List<String>, droppedCount: Int) {
        val args = Arguments.createMap()
        val lPaths = Arguments.createArray()
        for (path in paths) {
            lPaths.pushString(path)
        }
        args.putArray("localPaths", lPaths)
        args.putInt("droppedCount", droppedCount)
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
        updateWindowBackground()
        if (newConfig.hardKeyboardHidden == Configuration.HARDKEYBOARDHIDDEN_NO) {
            isUsingHardwareKeyboard = true
        } else if (newConfig.hardKeyboardHidden == Configuration.HARDKEYBOARDHIDDEN_YES) {
            isUsingHardwareKeyboard = false
        }
    }

    private fun updateWindowBackground() {
        window.setBackgroundDrawableResource(if (isNightForCurrentConfiguration()) R.color.black else R.color.white)
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
