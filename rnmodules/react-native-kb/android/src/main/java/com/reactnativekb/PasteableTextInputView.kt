package com.reactnativekb

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.util.AttributeSet
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import androidx.appcompat.widget.AppCompatEditText
import androidx.core.view.inputmethod.EditorInfoCompat
import androidx.core.view.inputmethod.InputConnectionCompat
import androidx.core.view.inputmethod.InputContentInfoCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.RCTEventEmitter
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

class PasteableTextInputView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = androidx.appcompat.R.attr.editTextStyle
) : AppCompatEditText(context, attrs, defStyleAttr) {

    init {
        // Enable content mime types for image paste
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N_MR1) {
            setContentMimeTypes(arrayOf("image/*"))
        }
    }

    override fun onCreateInputConnection(editorInfo: EditorInfo): InputConnection? {
        val ic = super.onCreateInputConnection(editorInfo) ?: return null

        EditorInfoCompat.setContentMimeTypes(editorInfo, arrayOf("image/*"))

        val callback = InputConnectionCompat.OnCommitContentListener { inputContentInfo, flags, _ ->
            // Read and process the image
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N_MR1 &&
                    (flags and InputConnectionCompat.INPUT_CONTENT_GRANT_READ_URI_PERMISSION) != 0
                ) {
                    inputContentInfo.requestPermission()
                }

                // Save the image to a temporary file
                val uri = inputContentInfo.contentUri
                val imagePath = saveImageToTempFile(uri)

                if (imagePath != null) {
                    // Send event to React Native
                    val event: WritableMap = Arguments.createMap()
                    event.putString("imagePath", imagePath)

                    val reactContext = context as ReactContext
                    reactContext
                        .getJSModule(RCTEventEmitter::class.java)
                        .receiveEvent(id, "topPasteImage", event)
                }

                true
            } catch (e: Exception) {
                NativeLogger.error("Error handling pasted image", e)
                false
            } finally {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N_MR1) {
                    inputContentInfo.releasePermission()
                }
            }
        }

        return InputConnectionCompat.createWrapper(ic, editorInfo, callback)
    }

    private fun saveImageToTempFile(uri: Uri): String? {
        return try {
            val contentResolver = context.contentResolver
            val inputStream: InputStream = contentResolver.openInputStream(uri) ?: return null

            // Create temp file
            val tempDir = context.cacheDir
            val fileName = "paste_image_${System.currentTimeMillis()}.jpg"
            val tempFile = File(tempDir, fileName)

            // Copy the content to the temp file
            FileOutputStream(tempFile).use { outputStream ->
                inputStream.copyTo(outputStream)
            }
            inputStream.close()

            tempFile.absolutePath
        } catch (e: Exception) {
            NativeLogger.error("Error saving pasted image to file", e)
            null
        }
    }

    fun setPlaceholder(placeholder: String?) {
        hint = placeholder
    }

    private fun setContentMimeTypes(mimeTypes: Array<String>) {
        // This is a no-op, but kept for clarity
        // The actual work is done in onCreateInputConnection
    }
}

