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
import androidx.core.app.NotificationCompat
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
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.media.MediaMuxer
import android.graphics.SurfaceTexture
import android.opengl.EGL14
import android.opengl.EGLExt
import android.opengl.GLES20
import android.opengl.GLES11Ext
import android.view.Surface
import java.nio.ByteBuffer
import java.nio.FloatBuffer
import java.nio.ByteOrder
import kotlin.math.min

@OptIn(FrameworkAPI::class)
class KbModule(reactContext: ReactApplicationContext?) : KbSpec(reactContext) {
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


    @ReactMethod
    override fun setEnablePasteImage(enabled: Boolean) {
        // not used
    }

    @ReactMethod
    override fun processVideo(path: String, promise: Promise) {
        Executors.newSingleThreadExecutor().execute {
            try {
                val inputFile = File(path)
                if (!inputFile.exists()) {
                    promise.reject("FILE_NOT_FOUND", "Video file not found: $path")
                    return@execute
                }

                val retriever = MediaMetadataRetriever()
                try {
                    retriever.setDataSource(path)
                    val widthStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
                    val heightStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
                    val fileSize = inputFile.length()

                    val width = widthStr?.toIntOrNull() ?: 0
                    val height = heightStr?.toIntOrNull() ?: 0
                    val maxPixels = 1920 * 1080
                    val maxFileSize = 50L * 1024 * 1024 // 50MB
                    val pixelCount = width * height

                    val needsCompression = pixelCount > maxPixels || fileSize > maxFileSize

                    if (!needsCompression) {
                        promise.resolve(path)
                        return@execute
                    }

                    val outputFile = File(inputFile.parent, "${inputFile.nameWithoutExtension}.processed.mp4")
                    compressVideo(path, outputFile.absolutePath, width, height, maxPixels)
                    promise.resolve(outputFile.absolutePath)
                } finally {
                    retriever.release()
                }
            } catch (e: Exception) {
                NativeLogger.error("Error compressing video", e)
                promise.reject("COMPRESSION_ERROR", "Failed to compress video: ${e.message}", e)
            }
        }
    }

    private fun compressVideo(inputPath: String, outputPath: String, originalWidth: Int, originalHeight: Int, maxPixels: Int) {
        val extractor = MediaExtractor()
        extractor.setDataSource(inputPath)

        val videoTrackIndex = findVideoTrack(extractor)
        if (videoTrackIndex < 0) {
            extractor.release()
            throw IOException("No video track found")
        }

        val inputFormat = extractor.getTrackFormat(videoTrackIndex)
        val mimeType = inputFormat.getString(MediaFormat.KEY_MIME) ?: "video/avc"
        val (outputWidth, outputHeight) = calculateOutputDimensions(originalWidth, originalHeight, maxPixels)
        val targetBitrate = calculateBitrate(outputWidth, outputHeight)
        val currentBitrate = inputFormat.getInteger(MediaFormat.KEY_BIT_RATE) ?: 0
        val needsResize = outputWidth != originalWidth || outputHeight != originalHeight
        val needsReencode = needsResize || (currentBitrate > 0 && targetBitrate < currentBitrate * 0.8)

        if (!needsReencode) {
            extractor.release()
            // No compression needed, return original path
            File(inputPath).copyTo(File(outputPath), overwrite = true)
            return
        }

        // Full transcoding with scaling and bitrate reduction
        transcodeVideoWithScaling(inputPath, outputPath, extractor, videoTrackIndex, inputFormat, originalWidth, originalHeight, outputWidth, outputHeight, targetBitrate)
    }

    private fun transcodeVideoWithScaling(
        inputPath: String,
        outputPath: String,
        extractor: MediaExtractor,
        videoTrackIndex: Int,
        inputFormat: MediaFormat,
        originalWidth: Int,
        originalHeight: Int,
        outputWidth: Int,
        outputHeight: Int,
        targetBitrate: Int
    ) {
        val decoder = MediaCodec.createDecoderByType(inputFormat.getString(MediaFormat.KEY_MIME) ?: "video/avc")
        val encoder = MediaCodec.createEncoderByType("video/avc")
        
        extractor.selectTrack(videoTrackIndex)
        
        // Configure encoder with surface-based input for scaling support
        val outputFormat = MediaFormat.createVideoFormat("video/avc", outputWidth, outputHeight)
        outputFormat.setInteger(MediaFormat.KEY_BIT_RATE, targetBitrate)
        outputFormat.setInteger(MediaFormat.KEY_FRAME_RATE, inputFormat.getInteger(MediaFormat.KEY_FRAME_RATE) ?: 30)
        outputFormat.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 2)
        outputFormat.setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)

        val encoderSurface = encoder.createInputSurface()
        encoder.configure(outputFormat, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        encoder.start()

        // Create EGL context and surface for scaling
        val eglDisplay = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY)
        if (eglDisplay == EGL14.EGL_NO_DISPLAY) {
            throw IOException("Failed to get EGL display")
        }
        
        val version = IntArray(2)
        if (!EGL14.eglInitialize(eglDisplay, version, 0, version, 1)) {
            throw IOException("Failed to initialize EGL")
        }

        val eglConfig = chooseEglConfig(eglDisplay)
        val eglContext = createEglContext(eglDisplay, eglConfig)
        val eglSurface = createEglSurface(eglDisplay, eglConfig, encoderSurface, outputWidth, outputHeight)
        
        EGL14.eglMakeCurrent(eglDisplay, eglSurface, eglSurface, eglContext)

        // Configure decoder to output to a surface (we'll render to encoder surface with scaling)
        val decoderSurfaceObj = createDecoderSurface(eglDisplay, eglConfig, originalWidth, originalHeight)
        decoder.configure(inputFormat, decoderSurfaceObj, null, 0)
        decoder.start()

        // Setup OpenGL for scaling
        setupGLScaling(originalWidth, originalHeight, outputWidth, outputHeight)

        val muxer = MediaMuxer(outputPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
        var muxerStarted = false
        var videoTrackIndexOutput = -1
        var audioTrackIndex = findAudioTrack(extractor)
        var audioTrackIndexOutput = -1

        // Setup audio
        val audioExtractor = MediaExtractor()
        audioExtractor.setDataSource(inputPath)
        if (audioTrackIndex >= 0) {
            audioExtractor.selectTrack(audioTrackIndex)
            val audioFormat = audioExtractor.getTrackFormat(audioTrackIndex)
            audioTrackIndexOutput = muxer.addTrack(audioFormat)
        }

        val bufferInfo = MediaCodec.BufferInfo()
        var inputEOS = false
        var outputEOS = false
        var encoderOutputFormat: MediaFormat? = null

        extractor.seekTo(0, MediaExtractor.SEEK_TO_CLOSEST_SYNC)

        // Process video: decode -> scale via OpenGL -> encode
        while (!outputEOS) {
            // Feed input to decoder
            if (!inputEOS) {
                val inputBufferIndex = decoder.dequeueInputBuffer(10000)
                if (inputBufferIndex >= 0) {
                    val inputBuffer = decoder.getInputBuffer(inputBufferIndex)
                    val sampleSize = extractor.readSampleData(inputBuffer!!, 0)
                    if (sampleSize < 0) {
                        decoder.queueInputBuffer(inputBufferIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                        inputEOS = true
                    } else {
                        decoder.queueInputBuffer(
                            inputBufferIndex, 0, sampleSize,
                            extractor.sampleTime, extractor.sampleFlags
                        )
                        extractor.advance()
                    }
                }
            }

            // Get decoded output - frames are rendered to decoderSurface, then scaled to encoderSurface
            val outputBufferIndex = decoder.dequeueOutputBuffer(bufferInfo, 10000)
            if (outputBufferIndex >= 0) {
                // Render decoded frame with scaling
                if (bufferInfo.size > 0) {
                    renderFrameWithScaling()
                    // Set presentation time for encoder
                    EGLExt.eglPresentationTimeANDROID(eglDisplay, eglSurface, bufferInfo.presentationTimeUs * 1000)
                    EGL14.eglSwapBuffers(eglDisplay, eglSurface)
                }
                decoder.releaseOutputBuffer(outputBufferIndex, true) // render to surface
                
                if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                    // Signal EOS to encoder via surface
                    EGLExt.eglPresentationTimeANDROID(eglDisplay, eglSurface, Long.MAX_VALUE)
                    EGL14.eglSwapBuffers(eglDisplay, eglSurface)
                }
            } else if (outputBufferIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                // Decoder output format changed
            }

            // Get encoded output
            val encoderOutputIndex = encoder.dequeueOutputBuffer(bufferInfo, 10000)
            if (encoderOutputIndex >= 0) {
                if (encoderOutputFormat == null) {
                    encoderOutputFormat = encoder.outputFormat
                    videoTrackIndexOutput = muxer.addTrack(encoderOutputFormat!!)
                    if (audioTrackIndexOutput >= 0 || videoTrackIndexOutput >= 0) {
                        muxer.start()
                        muxerStarted = true
                    }
                }

                if (muxerStarted && bufferInfo.size > 0) {
                    val encodedBuffer = encoder.getOutputBuffer(encoderOutputIndex)
                    if (encodedBuffer != null) {
                        muxer.writeSampleData(videoTrackIndexOutput, encodedBuffer, bufferInfo)
                    }
                }
                encoder.releaseOutputBuffer(encoderOutputIndex, false)

                if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                    outputEOS = true
                }
            } else if (encoderOutputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                encoderOutputFormat = encoder.outputFormat
                videoTrackIndexOutput = muxer.addTrack(encoderOutputFormat!!)
                if (audioTrackIndexOutput >= 0 || videoTrackIndexOutput >= 0) {
                    muxer.start()
                    muxerStarted = true
                }
            }
        }

        // Copy audio track
        if (audioTrackIndex >= 0 && muxerStarted) {
            copyAudioTrack(audioExtractor, muxer, audioTrackIndex, audioTrackIndexOutput, true)
        }

        // Cleanup
        EGL14.eglMakeCurrent(eglDisplay, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_CONTEXT)
        EGL14.eglDestroySurface(eglDisplay, eglSurface)
        EGL14.eglDestroyContext(eglDisplay, eglContext)
        EGL14.eglReleaseThread()
        EGL14.eglTerminate(eglDisplay)
        
        decoderSurface?.release()
        surfaceTexture?.release()
        if (textureId != 0) {
            GLES20.glDeleteTextures(1, intArrayOf(textureId), 0)
        }
        if (shaderProgram != 0) {
            GLES20.glDeleteProgram(shaderProgram)
        }
        
        decoder.stop()
        decoder.release()
        encoder.stop()
        encoder.release()
        encoderSurface.release()
        extractor.release()
        audioExtractor.release()
        if (muxerStarted) {
            muxer.stop()
        }
        muxer.release()
    }

    // OpenGL helper functions for scaling
    private fun chooseEglConfig(display: android.opengl.EGLDisplay): android.opengl.EGLConfig {
        val attribs = intArrayOf(
            EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT,
            EGL14.EGL_RED_SIZE, 8,
            EGL14.EGL_GREEN_SIZE, 8,
            EGL14.EGL_BLUE_SIZE, 8,
            EGL14.EGL_ALPHA_SIZE, 8,
            EGL14.EGL_NONE
        )
        val configs = arrayOfNulls<android.opengl.EGLConfig>(1)
        val numConfigs = IntArray(1)
        if (!EGL14.eglChooseConfig(display, attribs, 0, configs, 0, configs.size, numConfigs, 0)) {
            throw IOException("Failed to choose EGL config")
        }
        return configs[0]!!
    }

    private fun createEglContext(display: android.opengl.EGLDisplay, config: android.opengl.EGLConfig): android.opengl.EGLContext {
        val attribs = intArrayOf(EGL14.EGL_CONTEXT_CLIENT_VERSION, 2, EGL14.EGL_NONE)
        val context = EGL14.eglCreateContext(display, config, EGL14.EGL_NO_CONTEXT, attribs, 0)
        if (context == EGL14.EGL_NO_CONTEXT) {
            throw IOException("Failed to create EGL context")
        }
        return context
    }

    private fun createEglSurface(display: android.opengl.EGLDisplay, config: android.opengl.EGLConfig, surface: Surface, width: Int, height: Int): android.opengl.EGLSurface {
        val attribs = intArrayOf(EGL14.EGL_WIDTH, width, EGL14.EGL_HEIGHT, height, EGL14.EGL_NONE)
        val eglSurface = EGLExt.eglCreateWindowSurface(display, config, surface, attribs, 0)
        if (eglSurface == EGL14.EGL_NO_SURFACE) {
            throw IOException("Failed to create EGL surface")
        }
        return eglSurface
    }

    private var textureId: Int = 0
    private var surfaceTexture: SurfaceTexture? = null
    private var decoderSurface: Surface? = null
    private var shaderProgram: Int = 0
    private var positionHandle: Int = 0
    private var texCoordHandle: Int = 0
    private var textureHandle: Int = 0

    private val vertexShaderCode = """
        attribute vec4 aPosition;
        attribute vec2 aTexCoord;
        varying vec2 vTexCoord;
        void main() {
            gl_Position = aPosition;
            vTexCoord = aTexCoord;
        }
    """.trimIndent()

    private val fragmentShaderCode = """
        #extension GL_OES_EGL_image_external : require
        precision mediump float;
        varying vec2 vTexCoord;
        uniform samplerExternalOES uTexture;
        void main() {
            gl_FragColor = texture2D(uTexture, vTexCoord);
        }
    """.trimIndent()

    private val vertices = floatArrayOf(
        -1.0f, -1.0f,  // bottom left
         1.0f, -1.0f,  // bottom right
        -1.0f,  1.0f,  // top left
         1.0f,  1.0f   // top right
    )

    private val texCoords = floatArrayOf(
        0.0f, 1.0f,  // bottom left
        1.0f, 1.0f,  // bottom right
        0.0f, 0.0f,  // top left
        1.0f, 0.0f   // top right
    )

    private fun createDecoderSurface(display: android.opengl.EGLDisplay, config: android.opengl.EGLConfig, width: Int, height: Int): Surface {
        // Create SurfaceTexture for decoder output
        val textures = IntArray(1)
        GLES20.glGenTextures(1, textures, 0)
        textureId = textures[0]
        
        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textureId)
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
        
        surfaceTexture = SurfaceTexture(textureId)
        surfaceTexture!!.setDefaultBufferSize(width, height)
        decoderSurface = Surface(surfaceTexture)
        return decoderSurface!!
    }

    private fun setupGLScaling(inputWidth: Int, inputHeight: Int, outputWidth: Int, outputHeight: Int) {
        // Setup viewport for output resolution (this handles scaling)
        GLES20.glViewport(0, 0, outputWidth, outputHeight)
        GLES20.glClearColor(0.0f, 0.0f, 0.0f, 1.0f)
        
        // Compile and link shaders
        val vertexShader = loadShader(GLES20.GL_VERTEX_SHADER, vertexShaderCode)
        val fragmentShader = loadShader(GLES20.GL_FRAGMENT_SHADER, fragmentShaderCode)
        
        shaderProgram = GLES20.glCreateProgram()
        GLES20.glAttachShader(shaderProgram, vertexShader)
        GLES20.glAttachShader(shaderProgram, fragmentShader)
        GLES20.glLinkProgram(shaderProgram)
        
        // Get attribute/uniform locations
        positionHandle = GLES20.glGetAttribLocation(shaderProgram, "aPosition")
        texCoordHandle = GLES20.glGetAttribLocation(shaderProgram, "aTexCoord")
        textureHandle = GLES20.glGetUniformLocation(shaderProgram, "uTexture")
    }

    private fun loadShader(type: Int, shaderCode: String): Int {
        val shader = GLES20.glCreateShader(type)
        GLES20.glShaderSource(shader, shaderCode)
        GLES20.glCompileShader(shader)
        return shader
    }

    private fun renderFrameWithScaling() {
        // Update SurfaceTexture to get latest frame
        surfaceTexture?.updateTexImage()
        
        // Clear and render
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT)
        GLES20.glUseProgram(shaderProgram)
        
        // Bind texture
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textureId)
        GLES20.glUniform1i(textureHandle, 0)
        
        // Set vertex attributes
        val vertexBuffer = ByteBuffer.allocateDirect(vertices.size * 4).order(ByteOrder.nativeOrder()).asFloatBuffer()
        vertexBuffer.put(vertices).position(0)
        GLES20.glEnableVertexAttribArray(positionHandle)
        GLES20.glVertexAttribPointer(positionHandle, 2, GLES20.GL_FLOAT, false, 0, vertexBuffer)
        
        val texBuffer = ByteBuffer.allocateDirect(texCoords.size * 4).order(ByteOrder.nativeOrder()).asFloatBuffer()
        texBuffer.put(texCoords).position(0)
        GLES20.glEnableVertexAttribArray(texCoordHandle)
        GLES20.glVertexAttribPointer(texCoordHandle, 2, GLES20.GL_FLOAT, false, 0, texBuffer)
        
        // Draw
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
        
        GLES20.glDisableVertexAttribArray(positionHandle)
        GLES20.glDisableVertexAttribArray(texCoordHandle)
    }

    private fun remuxVideo(inputPath: String, outputPath: String) {
        // Remux video to optimize container format (helps with some file size reduction)
        val extractor = MediaExtractor()
        extractor.setDataSource(inputPath)

        val videoTrackIndex = findVideoTrack(extractor)
        val audioTrackIndex = findAudioTrack(extractor)

        if (videoTrackIndex < 0) {
            extractor.release()
            File(inputPath).copyTo(File(outputPath), overwrite = true)
            return
        }

        val muxer = MediaMuxer(outputPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
        var muxerStarted = false
        var videoTrackIndexOutput = -1
        var audioTrackIndexOutput = -1

        if (audioTrackIndex >= 0) {
            val audioFormat = extractor.getTrackFormat(audioTrackIndex)
            audioTrackIndexOutput = muxer.addTrack(audioFormat)
        }

        extractor.selectTrack(videoTrackIndex)
        val videoFormat = extractor.getTrackFormat(videoTrackIndex)
        videoTrackIndexOutput = muxer.addTrack(videoFormat)

        if (!muxerStarted && (audioTrackIndex < 0 || audioTrackIndexOutput >= 0)) {
            muxer.start()
            muxerStarted = true
        }

        val buffer = ByteBuffer.allocate(1024 * 1024)
        val bufferInfo = MediaCodec.BufferInfo()

        extractor.seekTo(0, MediaExtractor.SEEK_TO_CLOSEST_SYNC)
        extractor.selectTrack(videoTrackIndex)
        while (true) {
            val sampleSize = extractor.readSampleData(buffer, 0)
            if (sampleSize < 0) {
                break
            }
            bufferInfo.offset = 0
            bufferInfo.size = sampleSize
            bufferInfo.presentationTimeUs = extractor.sampleTime
            bufferInfo.flags = extractor.sampleFlags
            if (muxerStarted) {
                muxer.writeSampleData(videoTrackIndexOutput, buffer, bufferInfo)
            }
            extractor.advance()
        }

        if (audioTrackIndex >= 0) {
            copyAudioTrack(extractor, muxer, audioTrackIndex, audioTrackIndexOutput, muxerStarted)
        }

        extractor.release()
        if (muxerStarted) {
            muxer.stop()
        }
        muxer.release()
    }

    private fun findVideoTrack(extractor: MediaExtractor): Int {
        for (i in 0 until extractor.trackCount) {
            val format = extractor.getTrackFormat(i)
            val mime = format.getString(MediaFormat.KEY_MIME)
            if (mime?.startsWith("video/") == true) {
                return i
            }
        }
        return -1
    }

    private fun findAudioTrack(extractor: MediaExtractor): Int {
        for (i in 0 until extractor.trackCount) {
            val format = extractor.getTrackFormat(i)
            val mime = format.getString(MediaFormat.KEY_MIME)
            if (mime?.startsWith("audio/") == true) {
                return i
            }
        }
        return -1
    }

    private fun calculateOutputDimensions(width: Int, height: Int, maxPixels: Int): Pair<Int, Int> {
        val pixelCount = width * height
        if (pixelCount <= maxPixels) {
            return Pair(width, height)
        }

        val scale = kotlin.math.sqrt(maxPixels.toDouble() / pixelCount)
        val newWidth = (width * scale).toInt().let { if (it % 2 == 0) it else it - 1 }
        val newHeight = (height * scale).toInt().let { if (it % 2 == 0) it else it - 1 }
        return Pair(newWidth, newHeight)
    }

    private fun calculateBitrate(width: Int, height: Int): Int {
        val pixelCount = width * height
        return when {
            pixelCount > 1920 * 1080 -> 8000000 // 8 Mbps for > 1080p
            pixelCount > 1280 * 720 -> 5000000  // 5 Mbps for 1080p
            else -> 3000000 // 3 Mbps for 720p and below
        }
    }

    private fun copyAudioTrack(extractor: MediaExtractor, muxer: MediaMuxer, audioTrackIndex: Int, audioTrackIndexOutput: Int, muxerStarted: Boolean) {
        var muxerStartedLocal = muxerStarted
        val buffer = ByteBuffer.allocate(1024 * 1024)
        val bufferInfo = MediaCodec.BufferInfo()

        extractor.seekTo(0, MediaExtractor.SEEK_TO_CLOSEST_SYNC)
        extractor.selectTrack(audioTrackIndex)

        while (true) {
            val sampleSize = extractor.readSampleData(buffer, 0)
            if (sampleSize < 0) {
                break
            }

            bufferInfo.offset = 0
            bufferInfo.size = sampleSize
            bufferInfo.presentationTimeUs = extractor.sampleTime
            bufferInfo.flags = extractor.sampleFlags

            if (!muxerStartedLocal && audioTrackIndexOutput >= 0) {
                muxer.start()
                muxerStartedLocal = true
            }

            if (muxerStartedLocal) {
                muxer.writeSampleData(audioTrackIndexOutput, buffer, bufferInfo)
            }

            extractor.advance()
        }
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

    @ReactMethod(isBlockingSynchronousMethod = true)
    override fun getTypedConstants(): WritableMap {
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

        val constants: WritableMap = Arguments.createMap()
        constants.putBoolean("androidIsDeviceSecure", isDeviceSecure)
        constants.putBoolean("androidIsTestDevice", misTestDevice)
        constants.putString("appVersionCode", versionCode)
        constants.putString("appVersionName", versionName)
        constants.putBoolean("darkModeSupported", false)
        constants.putString("fsCacheDir", cacheDir)
        constants.putString("fsDownloadDir", downloadDir)
        constants.putString("guiConfig", readGuiConfig())
        constants.putString("serverConfig", serverConfig)
        constants.putBoolean("uses24HourClock", DateFormat.is24HourFormat(reactContext))
        constants.putString("version", version())
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


    @ReactMethod
    override fun shareListenersRegistered() {
        try {
            val activity: Activity? = reactContext.getCurrentActivity()
            if (activity != null) {
                val m: Method = activity.javaClass.getMethod("shareListenersRegistered")
                m.invoke(activity)
            }
        } catch (ex: Exception) {
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
            // note in JS initPlatformSpecific changes the cache dir so this works
            val fileUri: Uri = FileProvider.getUriForFile(reactContext, reactContext.getPackageName() + ".fileprovider", file)
            intent.putExtra(Intent.EXTRA_STREAM, fileUri)
            startSharing(intent, promise)
        } catch (ex: Exception) {
            promise.reject(Error("Error sharing file " + ex.getLocalizedMessage()))
        }
    }

    private fun startSharing(intent: Intent, promise: Promise) {
        val chooser: Intent = Intent.createChooser(intent, "Send to")
        // Android 5.1.1 fails `startActivity` below without this flag in the Intent.
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(chooser)
        promise.resolve(true)
    }

    @ReactMethod
    override fun androidShareText(text: String, mimeType: String, promise: Promise) {
        val intent: Intent = Intent(Intent.ACTION_SEND).setType(mimeType)
        intent.putExtra(Intent.EXTRA_TEXT, text)
        startSharing(intent, promise)
    }

    // Push
    @ReactMethod
    override fun checkPushPermissions(promise: Promise) {
        val managerCompat: NotificationManagerCompat = NotificationManagerCompat.from(reactContext)
        promise.resolve(managerCompat.areNotificationsEnabled())
    }

    @ReactMethod
    override fun requestPushPermissions(promise: Promise) {
        ensureFirebase()
        checkPushPermissions(promise)
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
    override fun getRegistrationToken(promise: Promise) {
        ensureFirebase()
        FirebaseMessaging.getInstance().getToken()
                .addOnCompleteListener(OnCompleteListener { task ->
                        if (!task.isSuccessful()) {
                            NativeLogger.info("Fetching FCM registration token failed " + task.getException())
                            promise.reject("Fetching FCM registration token failed")
                            return@OnCompleteListener
                        }

                        // Get new FCM registration token
                        val token: String? = task.result
                        if (token == null) {
                            promise.reject("null token")
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
        instance = this
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
        if (!Regex("""\w+\:.*""").matches(path)) {
            return path
        }
        if (path.startsWith("file://")) {
            return path.replace("file://", "")
        }
        val uri: Uri = Uri.parse(path)
        if (path.startsWith(FILE_PREFIX_BUNDLE_ASSET)) {
            return path
        } else {
            return PathResolver.getRealPathFromURI(reactContext, uri) ?: ""
        }
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

    @ReactMethod
    override fun setApplicationIconBadgeNumber(badge: Double) {
        ShortcutBadger.applyCount(reactContext, badge.toInt())
    }

    @ReactMethod
    override fun getInitialNotification(promise: Promise) {
        val bundle = KbModule.initialNotificationBundle
        if (bundle != null) {
            try {
                @Suppress("UNCHECKED_CAST")
                val payload: WritableMap = Arguments.fromBundle(bundle) as WritableMap
                promise.resolve(payload)
            } catch (e: Exception) {
                promise.resolve(null)
            }
        } else {
            promise.resolve(null)
        }
    }

    private fun emitPushNotificationInternal(notification: Bundle) {
        android.util.Log.d("KbModule", "emitPushNotificationInternal called")
        if (reactContext.hasActiveCatalystInstance()) {
            android.util.Log.d("KbModule", "emitPushNotificationInternal has active catalyst instance, emitting event")
            try {
                val payload = Arguments.fromBundle(notification)
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("onPushNotification", payload)
                android.util.Log.d("KbModule", "emitPushNotificationInternal event emitted successfully")
            } catch (e: Exception) {
                android.util.Log.e("KbModule", "emitPushNotificationInternal failed to emit: " + e.message)
            }
        } else {
            android.util.Log.w("KbModule", "emitPushNotificationInternal no active catalyst instance")
        }
    }

    @ReactMethod
    override fun removeAllPendingNotificationRequests() {
    }

    @ReactMethod
    override fun addNotificationRequest(config: ReadableMap, promise: Promise) {
        val body = config.getString("body")
        val id = config.getString("id")

        if (body == null || id == null) {
            promise.reject("invalid_config", "body and id are required")
            return
        }

        val notificationManager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        val channelId = "keybase_notifications"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = android.app.NotificationChannel(
                channelId,
                "Keybase Notifications",
                android.app.NotificationManager.IMPORTANCE_DEFAULT
            )
            notificationManager.createNotificationChannel(channel)
        }

        val notification = NotificationCompat.Builder(reactContext, channelId)
            .setContentText(body)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .build()

        notificationManager.notify(id.hashCode(), notification)
        promise.resolve(null)
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
    override fun notifyJSReady() {
        NativeLogger.info("JS signaled ready, starting ReadFromKBLib loop")
        try {
            // Signal to Go that JS is ready
            Keybase.notifyJSReady()

            // Start the executor to read from Go
            if (executor == null) {
                val ex = Executors.newSingleThreadExecutor()
                executor = ex
                ex.execute(ReadFromKBLib(reactContext))
            }
        } catch (e: Exception) {
            NativeLogger.error("Exception in notifyJSReady", e)
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

    private fun sendHardwareKeyEvent(keyName: String) {
        val params = Arguments.createMap()
        params.putString("pressedKey", keyName)
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(HW_KEY_EVENT, params)
    }

    companion object {
        const val NAME: String = "Kb"
        private val RN_NAME: String = "ReactNativeJS"
        private val RPC_META_EVENT_NAME: String = "kb-meta-engine-event"
        private val RPC_META_EVENT_ENGINE_RESET: String = "kb-engine-reset"
        private const val MAX_TEXT_FILE_SIZE = 100 * 1024 // 100 kiB
        private val LINE_SEPARATOR: String? = System.getProperty("line.separator")
        private const val HW_KEY_EVENT: String = "hardwareKeyPressed"

        var instance: KbModule? = null
        @JvmStatic
        internal var initialNotificationBundle: Bundle? = null

        @JvmStatic
        fun keyPressed(keyName: String) {
            instance?.sendHardwareKeyEvent(keyName)
        }

        @JvmStatic
        fun setInitialNotification(bundle: Bundle?) {
            initialNotificationBundle = bundle
        }

        @JvmStatic
        fun isReactNativeRunning(): Boolean {
            return instance != null
        }

        @JvmStatic
        fun emitPushNotification(notification: Bundle) {
            if (instance == null) {
                android.util.Log.w("KbModule", "emitPushNotification called but instance is null (app may not be running)")
                return
            }
            android.util.Log.d("KbModule", "emitPushNotification called, instance exists")
            instance?.emitPushNotificationInternal(notification)
        }

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
