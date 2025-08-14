package io.keybase.ossifrage.util

import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import keybase.NativeVideoHelper
import java.io.ByteArrayOutputStream

class VideoHelper : NativeVideoHelper {
    override fun thumbnail(filename: String): ByteArray {
        val retriever = MediaMetadataRetriever()
        try {
            retriever.setDataSource(filename)
            val bmp = retriever.frameAtTime ?: return ByteArray(0)
            ByteArrayOutputStream().use { stream ->
                bmp.compress(Bitmap.CompressFormat.JPEG, 80, stream)
                return stream.toByteArray()
            }
        } catch (e: Exception) {
            return ByteArray(0)
        } finally {
            retriever.release()
        }
    }

    override fun duration(filename: String): Long {
        return try {
            val retriever = MediaMetadataRetriever()
            retriever.setDataSource(filename)
            val time = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                    ?: return 0
            val ret = time.toInt()
            retriever.release()
            ret.toLong()
        } catch (e: Exception) {
            0
        }
    }
}
