package io.keybase.ossifrage.util

import android.graphics.Bitmap
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import keybase.NativeVideoHelper
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.sqrt

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

    override fun audioAmps(filename: String): ByteArray {
        val numSamples = 60
        val extractor = MediaExtractor()
        var codec: MediaCodec? = null
        try {
            extractor.setDataSource(filename)
            val audioTrackIndex = (0 until extractor.trackCount).firstOrNull { i ->
                extractor.getTrackFormat(i).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
            } ?: return ByteArray(0)

            extractor.selectTrack(audioTrackIndex)
            val format = extractor.getTrackFormat(audioTrackIndex)
            val mime = format.getString(MediaFormat.KEY_MIME) ?: return ByteArray(0)

            codec = MediaCodec.createDecoderByType(mime)
            codec.configure(format, null, null, 0)
            codec.start()

            val sampleRate = if (format.containsKey(MediaFormat.KEY_SAMPLE_RATE)) {
                format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            } else {
                44_100
            }
            val channelCount = if (format.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) {
                format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            } else {
                1
            }
            val durationUs = if (format.containsKey(MediaFormat.KEY_DURATION)) {
                format.getLong(MediaFormat.KEY_DURATION)
            } else {
                0L
            }
            val totalSamplesEstimate = maxOf(
                numSamples.toLong(),
                durationUs * sampleRate.toLong() * channelCount.toLong() / 1_000_000L,
            )
            val sumSq = DoubleArray(numSamples)
            val counts = IntArray(numSamples)
            var sampleIndex = 0L
            val info = MediaCodec.BufferInfo()
            var inputDone = false
            var outputDone = false

            while (!outputDone) {
                if (!inputDone) {
                    val inputIndex = codec.dequeueInputBuffer(10_000L)
                    if (inputIndex >= 0) {
                        val inputBuffer = codec.getInputBuffer(inputIndex)!!
                        val sampleSize = extractor.readSampleData(inputBuffer, 0)
                        if (sampleSize < 0) {
                            codec.queueInputBuffer(inputIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                            inputDone = true
                        } else {
                            codec.queueInputBuffer(inputIndex, 0, sampleSize, extractor.sampleTime, 0)
                            extractor.advance()
                        }
                    }
                }
                val outputIndex = codec.dequeueOutputBuffer(info, 10_000L)
                if (outputIndex >= 0) {
                    val outputBuffer = codec.getOutputBuffer(outputIndex)
                    if (outputBuffer != null && info.size > 0) {
                        // PCM output is 16-bit signed by default on Android.
                        val pcmBuffer = outputBuffer.duplicate()
                        pcmBuffer.position(info.offset)
                        pcmBuffer.limit(info.offset + info.size)
                        val shortBuf = pcmBuffer.slice().order(ByteOrder.nativeOrder()).asShortBuffer()
                        while (shortBuf.hasRemaining()) {
                            val sample = shortBuf.get().toDouble() / Short.MAX_VALUE.toDouble()
                            val bucket = minOf(
                                numSamples - 1,
                                ((sampleIndex * numSamples) / totalSamplesEstimate).toInt(),
                            )
                            sumSq[bucket] += sample * sample
                            counts[bucket]++
                            sampleIndex++
                        }
                    }
                    codec.releaseOutputBuffer(outputIndex, false)
                    if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) outputDone = true
                }
            }

            if (sampleIndex == 0L) return ByteArray(0)

            val result = ByteBuffer.allocate(numSamples * 4).order(ByteOrder.LITTLE_ENDIAN)
            for (i in 0 until numSamples) {
                if (counts[i] > 0) {
                    result.putFloat(sqrt(sumSq[i] / counts[i]).toFloat())
                } else {
                    result.putFloat(0f)
                }
            }
            return result.array()
        } catch (e: Exception) {
            return ByteArray(0)
        } finally {
            runCatching { codec?.stop() }
            codec?.release()
            extractor.release()
        }
    }
}
