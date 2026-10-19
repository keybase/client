package io.keybase.ossifrage

import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
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
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.reactnativekb.IncomingShareCache
import com.reactnativekb.IncomingShareFileName
import com.reactnativekb.IncomingShareRelay
import com.reactnativekb.IncomingShareSource
import com.reactnativekb.ShareOutbox
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
        // With saved state this Activity is a recreation, and its intent was already
        // captured by the instance it replaces.
        if (savedInstanceState == null) {
            captureIntent(intent)
        }

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

    private fun ownProviderAuthorities(context: Context): Set<String> {
        val pm = context.packageManager
        val info = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            pm.getPackageInfo(context.packageName, PackageManager.PackageInfoFlags.of(PackageManager.GET_PROVIDERS.toLong()))
        } else {
            @Suppress("DEPRECATION")
            pm.getPackageInfo(context.packageName, PackageManager.GET_PROVIDERS)
        }
        return IncomingShareSource.authorities(info.providers?.map { it.authority }.orEmpty())
    }

    // Copies a shared item into the share cache. Returns null, leaving nothing
    // behind, when the item can't be copied whole: a missing or partial file
    // must never be sent.
    // ownAuthorities is null when they couldn't be read; then nothing is copied.
    private fun copySharedUri(context: Context, uri: Uri, ownAuthorities: Set<String>?): String? {
        if (ownAuthorities == null) return null
        val resolver = context.contentResolver
        return try {
            if (!IncomingShareSource.canCopy(uri.scheme, uri.authority, ownAuthorities, ShareOutbox.authority(context))) {
                NativeLogger.warn("Dropping shared item: scheme=${uri.scheme} authority=${uri.authority} is not another app's provider")
                return null
            }
            val ext = resolver.getType(uri)?.let { MimeTypeMap.getSingleton().getExtensionFromMimeType(it) }
            val name = IncomingShareFileName.make(queryDisplayName(resolver, uri), ext)
            val input = resolver.openInputStream(uri) ?: throw IOException("no stream for $uri")
            input.use { IncomingShareCache.copyIn(IncomingShareCache.dir(context), it, name) }.path
        } catch (e: Exception) {
            NativeLogger.warn("Unable to copy shared item $uri", e)
            null
        }
    }

    override fun onResume() {
        NativeLogger.info("Activity onResume")
        super.onResume()
        (application as MainApplication).lifecycleReporter.onMainActivityResume()
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

    // Snapshot share data out of the intent right away and hand it to the relay, which holds
    // it until JS is ready to route it: URI permission grants and clip data are tied to the
    // delivered intent, and JS may not be ready until much later (after login).
    private fun captureIntent(intent: Intent) {
        if (Intent.ACTION_SEND != intent.action && Intent.ACTION_SEND_MULTIPLE != intent.action) {
            return
        }
        // Reopening from recents hands back the share intent the task started with.
        if (intent.flags and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY != 0) {
            return
        }
        // Reading the extras unparcels the sender's bundle, which throws on a class we
        // don't have (BadParcelableException); that share is unusable, not a crash.
        val (uris, subject, text) = try {
            Triple(
                extractSharedUris(intent),
                sharedText(intent, Intent.EXTRA_SUBJECT),
                sharedText(intent, Intent.EXTRA_TEXT)
                    ?: sharedText(intent, Intent.EXTRA_HTML_TEXT)?.let {
                        // fromHtml leaves an object-replacement character where each image was.
                        HtmlCompat.fromHtml(it, HtmlCompat.FROM_HTML_MODE_LEGACY).toString()
                            .replace("\uFFFC", "").trim().takeIf { t -> t.isNotEmpty() }
                    },
            )
        } catch (e: Exception) {
            NativeLogger.warn("MainActivity.captureIntent: unreadable share extras, ignoring the share", e)
            return
        }
        NativeLogger.info("MainActivity.captureIntent: action=${intent.action}, uriCount=${uris.size}")

        val textPayload = listOfNotNull(subject, text).joinToString(" ")
        // Only a single SEND: a SEND_MULTIPLE of text files is files, whatever text rides along.
        val isTextSend = Intent.ACTION_SEND == intent.action && intent.type?.startsWith("text/") == true
        val relay = IncomingShareRelay.shared

        if (isTextSend && textPayload.isNotEmpty()) {
            // Text-type intent (e.g. URL from Chrome): prefer text over any preview images
            relay.fill(relay.begin(), textShare(text ?: textPayload, 0))
        } else if (uris.isEmpty()) {
            if (textPayload.isNotEmpty()) {
                relay.fill(relay.begin(), textShare(textPayload, 0))
            } else {
                NativeLogger.warn("MainActivity.captureIntent: share had no text or files, type=${intent.type}")
            }
        } else {
            val token = relay.begin()
            // Copying out of the content providers can be slow for big files; don't
            // block the main thread on it.
            val context: Context = applicationContext
            Thread {
                val ownAuthorities = try {
                    ownProviderAuthorities(context)
                } catch (e: Exception) {
                    NativeLogger.warn("Unable to read the app's provider authorities", e)
                    null
                }
                val filePaths = uris.mapNotNull { uri -> copySharedUri(context, uri, ownAuthorities) }
                // How many shared items couldn't be copied.
                val droppedCount = uris.size - filePaths.size
                val share = if (filePaths.isEmpty() && textPayload.isNotEmpty()) {
                    // Fallback: non-text MIME but no files resolved, send text
                    textShare(textPayload, droppedCount)
                } else {
                    IncomingShareRelay.Share(null, filePaths, droppedCount)
                }
                relay.fill(token, share)
            }.start()
        }
    }

    private fun textShare(text: String, droppedCount: Int) =
        IncomingShareRelay.Share(text, emptyList(), droppedCount)

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
