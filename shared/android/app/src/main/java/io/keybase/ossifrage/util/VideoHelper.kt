package io.keybase.ossifrage.util

import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import keybase.NativeVideoHelper
import java.io.ByteArrayOutputStream

class VideoHelper : NativeVideoHelper {
    override fun thumbnail(filename: String): ByteArray {
        return try {
            val retriever = MediaMetadataRetriever()
            retriever.setDataSource(filename)
            val bmp = retriever.frameAtTime ?: return ByteArray(0)
            val stream = ByteArrayOutputStream()
            bmp.compress(Bitmap.CompressFormat.JPEG, 100, stream)
            val ret = stream.toByteArray()
            retriever.release()
            ret
        } catch (e: Exception) {
            ByteArray(0)
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
