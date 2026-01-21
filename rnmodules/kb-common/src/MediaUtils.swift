import Foundation
import AVFoundation
import UIKit
import ImageIO

struct MediaProcessingConfig {
    static let imageMaxPixelSize: Int = 1200
    static let imageCompressionQuality: CGFloat = 0.85
    static let videoMaxPixels: Int = 1920 * 1080
    static let videoMaxFileSize: Int64 = 50 * 1024 * 1024
    static let videoMaxWidth: Int = 1280
    static let videoMaxHeight: Int = 720
    static let videoMaxBitrate: Int = 4_000_000
    static let videoMaxFrameRate: Int = 30
}

enum MediaUtilsError: Error, LocalizedError {
    case invalidInput(String)
    case imageProcessingFailed(String)
    case videoProcessingFailed(String)
    case fileOperationFailed(String)
    
    var errorDescription: String? {
        switch self {
        case .invalidInput(let message): return "Invalid input: \(message)"
        case .imageProcessingFailed(let message): return "Image processing failed: \(message)"
        case .videoProcessingFailed(let message): return "Video processing failed: \(message)"
        case .fileOperationFailed(let message): return "File operation failed: \(message)"
        }
    }
}

typealias ProcessMediaCompletion = (Result<URL, Error>) -> Void
typealias ProcessMediaProgressCallback = (Float) -> Void

@objc(MediaUtils)
class MediaUtils: NSObject {
    private static var scaledImageOptions: CFDictionary {
        return [
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceThumbnailMaxPixelSize: MediaProcessingConfig.imageMaxPixelSize
        ] as CFDictionary
    }
    
    @objc static func processImage(fromOriginal url: URL,
                                 completion: @escaping (Error?, URL?) -> Void) {
        processImageAsync(fromOriginal: url) { result in
            switch result {
            case .success(let url):
                completion(nil, url)
            case .failure(let error):
                completion(error, nil)
            }
        }
    }
    
    static func processImageAsync(fromOriginal url: URL,
                                completion: @escaping ProcessMediaCompletion) {
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let processedURL = try processImageSync(fromOriginal: url)
                DispatchQueue.main.async {
                    completion(.success(processedURL))
                }
            } catch {
                DispatchQueue.main.async {
                    completion(.failure(error))
                }
            }
        }
    }
    
    private static func processImageSync(fromOriginal url: URL) throws -> URL {
        // Validate input
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw MediaUtilsError.invalidInput("File does not exist at path: \(url.path)")
        }
        
        // Strip EXIF data first
        try stripImageExif(at: url)
        
        // Create scaled version
        let basename = url.deletingPathExtension().lastPathComponent
        let parent = url.deletingLastPathComponent()
        let scaledURL = parent.appendingPathComponent("\(basename).scaled.jpg")
        
        return try autoreleasepool {
            guard let cgSource = CGImageSourceCreateWithURL(url as CFURL, nil) else {
                throw MediaUtilsError.imageProcessingFailed("Failed to create image source")
            }
            
            try scaleDownCGImageSource(cgSource, dstURL: scaledURL, options: scaledImageOptions)
            return scaledURL
        }
    }
    
    @objc static func processVideo(fromOriginal url: URL,
                                 completion: @escaping (Error?, URL?) -> Void) {
        processVideoAsync(fromOriginal: url) { result in
            switch result {
            case .success(let url):
                completion(nil, url)
            case .failure(let error):
                completion(error, nil)
            }
        }
    }
    
    static func processVideoAsync(fromOriginal url: URL,
                                progress: ProcessMediaProgressCallback? = nil,
                                completion: @escaping ProcessMediaCompletion) {
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let processedURL = try processVideoSync(fromOriginal: url, progress: progress)
                DispatchQueue.main.async {
                    completion(.success(processedURL))
                }
            } catch {
                DispatchQueue.main.async {
                    completion(.failure(error))
                }
            }
        }
    }
    
    private static func processVideoSync(fromOriginal url: URL,
                                       progress: ProcessMediaProgressCallback? = nil) throws -> URL {
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw MediaUtilsError.invalidInput("File does not exist at path: \(url.path)")
        }
        
        let asset = AVURLAsset(url: url)
        
        try validateVideoAsset(asset)
        
        let basename = url.deletingPathExtension().lastPathComponent
        let parent = url.deletingLastPathComponent()
        let processedURL = parent.appendingPathComponent("\(basename).processed.mp4")
        
        try exportVideoWithSettings(asset: asset,
                                   outputURL: processedURL,
                                   maxWidth: MediaProcessingConfig.videoMaxWidth,
                                   maxHeight: MediaProcessingConfig.videoMaxHeight,
                                   maxBitrate: MediaProcessingConfig.videoMaxBitrate,
                                   maxFrameRate: MediaProcessingConfig.videoMaxFrameRate,
                                   progress: progress)
        
        return processedURL
    }
    
    private static func validateVideoAsset(_ asset: AVURLAsset) throws {
        guard asset.isReadable else {
            throw MediaUtilsError.videoProcessingFailed("Video asset is not readable")
        }
        
        let videoTracks = asset.tracks(withMediaType: .video)
        guard !videoTracks.isEmpty else {
            throw MediaUtilsError.videoProcessingFailed("No video tracks found")
        }
        
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        
        do {
            _ = try generator.copyCGImage(at: CMTime(seconds: 0, preferredTimescale: 1), actualTime: nil)
        } catch {
            throw MediaUtilsError.videoProcessingFailed("Failed to generate video thumbnail: \(error.localizedDescription)")
        }
    }
    
    private static func calculateOutputDimensions(width: CGFloat, height: CGFloat, maxWidth: Int, maxHeight: Int) -> (width: Int, height: Int) {
        let inputWidth = width
        let inputHeight = height
        
        if inputWidth <= CGFloat(maxWidth) && inputHeight <= CGFloat(maxHeight) {
            return (Int(inputWidth), Int(inputHeight))
        }
        
        let widthRatio = CGFloat(maxWidth) / inputWidth
        let heightRatio = CGFloat(maxHeight) / inputHeight
        let scale = min(widthRatio, heightRatio)
        
        var outputWidth = Int(inputWidth * scale)
        var outputHeight = Int(inputHeight * scale)
        
        if outputWidth % 2 != 0 {
            outputWidth -= 1
        }
        if outputHeight % 2 != 0 {
            outputHeight -= 1
        }
        
        return (outputWidth, outputHeight)
    }
    
    private static func getVideoTrackProperties(track: AVAssetTrack) -> (frameRate: Float, dimensions: CGSize) {
        let frameRate = track.nominalFrameRate
        let size = track.naturalSize
        return (frameRate, size)
    }
    
    private static func getAudioOutputSettings(from formatDescription: CMFormatDescription) -> [String: Any]? {
        guard let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(formatDescription) else {
            return nil
        }
        
        let sampleRate = Int(asbd.pointee.mSampleRate)
        let channels = Int(asbd.pointee.mChannelsPerFrame)
        
        var audioSettings: [String: Any] = [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: sampleRate,
            AVNumberOfChannelsKey: channels
        ]
        
        if channels > 0 {
            audioSettings[AVEncoderBitRateKey] = channels * 64000
        }
        
        return audioSettings
    }
    
    private static func exportVideoWithSettings(asset: AVURLAsset,
                                              outputURL: URL,
                                              maxWidth: Int,
                                              maxHeight: Int,
                                              maxBitrate: Int,
                                              maxFrameRate: Int,
                                              progress: ProcessMediaProgressCallback?) throws {
        
        if FileManager.default.fileExists(atPath: outputURL.path) {
            do {
                try FileManager.default.removeItem(at: outputURL)
            } catch {
                throw MediaUtilsError.fileOperationFailed("Failed to remove existing output file: \(error.localizedDescription)")
            }
        }
        
        var outputFileCreated = false
        defer {
            if outputFileCreated {
                try? FileManager.default.removeItem(at: outputURL)
            }
        }
        
        let videoTracks = asset.tracks(withMediaType: .video)
        guard let videoTrack = videoTracks.first else {
            throw MediaUtilsError.videoProcessingFailed("No video track found")
        }
        
        let audioTracks = asset.tracks(withMediaType: .audio)
        let composition = AVMutableComposition()
        
        let videoComposition = AVMutableVideoComposition()
        let (originalFrameRate, originalSize) = getVideoTrackProperties(track: videoTrack)
        let (outputWidth, outputHeight) = calculateOutputDimensions(
            width: originalSize.width,
            height: originalSize.height,
            maxWidth: maxWidth,
            maxHeight: maxHeight
        )
        
        let targetFrameRate = min(originalFrameRate, Float(maxFrameRate))
        let frameDuration = CMTime(value: 1, timescale: Int32(targetFrameRate))
        
        videoComposition.renderSize = CGSize(width: outputWidth, height: outputHeight)
        videoComposition.frameDuration = frameDuration
        
        if outputWidth == Int(originalSize.width) && outputHeight == Int(originalSize.height) && targetFrameRate == originalFrameRate {
            videoComposition.renderScale = 1.0
        }
        
        guard let compositionVideoTrack = composition.addMutableTrack(
            withMediaType: .video,
            preferredTrackID: kCMPersistentTrackID_Invalid
        ) else {
            throw MediaUtilsError.videoProcessingFailed("Failed to create composition video track")
        }
        
        do {
            try compositionVideoTrack.insertTimeRange(
                CMTimeRange(start: .zero, duration: asset.duration),
                of: videoTrack,
                at: .zero
            )
            compositionVideoTrack.preferredTransform = videoTrack.preferredTransform
        } catch {
            throw MediaUtilsError.videoProcessingFailed("Failed to insert video track: \(error.localizedDescription)")
        }
        
        var compositionAudioTrack: AVMutableCompositionTrack?
        if let firstAudioTrack = audioTracks.first {
            guard let track = composition.addMutableTrack(
                withMediaType: .audio,
                preferredTrackID: kCMPersistentTrackID_Invalid
            ) else {
                throw MediaUtilsError.videoProcessingFailed("Failed to create composition audio track")
            }
            
            do {
                try track.insertTimeRange(
                    CMTimeRange(start: .zero, duration: asset.duration),
                    of: firstAudioTrack,
                    at: .zero
                )
                compositionAudioTrack = track
            } catch {
                throw MediaUtilsError.videoProcessingFailed("Failed to insert audio track: \(error.localizedDescription)")
            }
        }
        
        let instruction = AVMutableVideoCompositionInstruction()
        instruction.timeRange = CMTimeRange(start: .zero, duration: asset.duration)
        
        let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: compositionVideoTrack)
        let transform = videoTrack.preferredTransform
        let scaleX = CGFloat(outputWidth) / originalSize.width
        let scaleY = CGFloat(outputHeight) / originalSize.height
        let scaleTransform = CGAffineTransform(scaleX: scaleX, y: scaleY)
        let scaledTransform = transform.concatenating(scaleTransform)
        layerInstruction.setTransform(scaledTransform, at: .zero)
        
        instruction.layerInstructions = [layerInstruction]
        videoComposition.instructions = [instruction]
        
        let videoSettings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: outputWidth,
            AVVideoHeightKey: outputHeight,
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: maxBitrate,
                AVVideoMaxKeyFrameIntervalKey: Int(targetFrameRate * 2),
                AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
            ]
        ]
        
        guard let assetWriter = try? AVAssetWriter(outputURL: outputURL, fileType: .mp4) else {
            throw MediaUtilsError.videoProcessingFailed("Failed to create asset writer")
        }
        
        let videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
        videoInput.expectsMediaDataInRealTime = false
        
        guard assetWriter.canAdd(videoInput) else {
            throw MediaUtilsError.videoProcessingFailed("Cannot add video input to asset writer")
        }
        assetWriter.add(videoInput)
        
        var audioInput: AVAssetWriterInput?
        let hasAudio = compositionAudioTrack != nil
        if hasAudio, let compositionAudioTrack = compositionAudioTrack {
            let formatDescriptions = compositionAudioTrack.formatDescriptions
            if let formatDescriptionAny = formatDescriptions.first,
               let formatDescription = formatDescriptionAny as? CMFormatDescription {
                let audioSettings = getAudioOutputSettings(from: formatDescription)
                audioInput = AVAssetWriterInput(mediaType: .audio, outputSettings: audioSettings)
                audioInput?.expectsMediaDataInRealTime = false
                if let audioInput = audioInput {
                    guard assetWriter.canAdd(audioInput) else {
                        throw MediaUtilsError.videoProcessingFailed("Cannot add audio input to asset writer")
                    }
                    assetWriter.add(audioInput)
                }
            }
        }
        
        let semaphore = DispatchSemaphore(value: 0)
        var exportError: Error?
        
        guard let assetReader = try? AVAssetReader(asset: composition) else {
            throw MediaUtilsError.videoProcessingFailed("Failed to create asset reader")
        }
        
        let videoOutput = AVAssetReaderVideoCompositionOutput(
            videoTracks: [compositionVideoTrack],
            videoSettings: nil
        )
        videoOutput.videoComposition = videoComposition
        videoOutput.alwaysCopiesSampleData = false
        
        guard assetReader.canAdd(videoOutput) else {
            assetReader.cancelReading()
            throw MediaUtilsError.videoProcessingFailed("Cannot add video output to asset reader")
        }
        assetReader.add(videoOutput)
        
        var audioOutput: AVAssetReaderTrackOutput?
        if let compositionAudioTrack = compositionAudioTrack {
            let audioDecompressionSettings: [String: Any] = [
                AVFormatIDKey: kAudioFormatLinearPCM,
                AVLinearPCMBitDepthKey: 16,
                AVLinearPCMIsBigEndianKey: false,
                AVLinearPCMIsFloatKey: false,
                AVLinearPCMIsNonInterleaved: false
            ]
            let output = AVAssetReaderTrackOutput(track: compositionAudioTrack, outputSettings: audioDecompressionSettings)
            output.alwaysCopiesSampleData = false
            guard assetReader.canAdd(output) else {
                assetReader.cancelReading()
                throw MediaUtilsError.videoProcessingFailed("Cannot add audio output to asset reader")
            }
            assetReader.add(output)
            audioOutput = output
        }
        
        guard assetWriter.startWriting() else {
            assetReader.cancelReading()
            throw MediaUtilsError.videoProcessingFailed("Failed to start writing: \(assetWriter.error?.localizedDescription ?? "Unknown error")")
        }
        outputFileCreated = true
        
        guard assetReader.startReading() else {
            assetReader.cancelReading()
            throw MediaUtilsError.videoProcessingFailed("Failed to start reading: \(assetReader.error?.localizedDescription ?? "Unknown error")")
        }
        
        assetWriter.startSession(atSourceTime: .zero)
        
        let videoQueue = DispatchQueue(label: "videoQueue")
        let audioQueue = DispatchQueue(label: "audioQueue")
        let syncQueue = DispatchQueue(label: "syncQueue")
        
        var videoFinished = false
        var audioFinished = false
        var writerFinished = false
        let totalDuration = asset.duration
        var lastProgressUpdate: CMTime = .zero
        
        func tryFinishWriter() {
            syncQueue.sync {
                guard !writerFinished else { return }
                let shouldFinish = videoFinished && (audioFinished || !hasAudio)
                guard shouldFinish else { return }
                writerFinished = true
                assetWriter.finishWriting {
                    syncQueue.async {
                        exportError = assetWriter.error
                    }
                    semaphore.signal()
                }
            }
        }
        
        videoInput.requestMediaDataWhenReady(on: videoQueue) {
            while videoInput.isReadyForMoreMediaData {
                guard let sampleBuffer = videoOutput.copyNextSampleBuffer() else {
                    if let readerError = assetReader.error {
                        assetReader.cancelReading()
                        syncQueue.sync {
                            videoFinished = true
                            if exportError == nil {
                                exportError = readerError
                            }
                        }
                        tryFinishWriter()
                        return
                    }
                    videoInput.markAsFinished()
                    syncQueue.sync {
                        videoFinished = true
                    }
                    if let progress = progress {
                        DispatchQueue.main.async {
                            progress(1.0)
                        }
                    }
                    tryFinishWriter()
                    return
                }
                
                let presentationTime = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
                if let progress = progress, totalDuration.seconds > 0 {
                    let progressValue = Float(presentationTime.seconds / totalDuration.seconds)
                    var shouldUpdate = false
                    syncQueue.sync {
                        if CMTimeCompare(presentationTime, lastProgressUpdate) > 0 || CMTimeCompare(lastProgressUpdate, .zero) == 0 {
                            lastProgressUpdate = presentationTime
                            shouldUpdate = true
                        }
                    }
                    if shouldUpdate {
                        DispatchQueue.main.async {
                            progress(min(progressValue, 1.0))
                        }
                    }
                }
                
                let appendSucceeded = videoInput.append(sampleBuffer)
                if !appendSucceeded {
                    autoreleasepool {
                        _ = sampleBuffer
                    }
                    assetReader.cancelReading()
                    videoInput.markAsFinished()
                    syncQueue.sync {
                        videoFinished = true
                        exportError = assetWriter.error
                    }
                    tryFinishWriter()
                    return
                }
            }
        }
        
        if hasAudio, let audioOutput = audioOutput, let audioInput = audioInput {
            audioInput.requestMediaDataWhenReady(on: audioQueue) {
                while audioInput.isReadyForMoreMediaData {
                    guard let sampleBuffer = audioOutput.copyNextSampleBuffer() else {
                        if let readerError = assetReader.error {
                            assetReader.cancelReading()
                            syncQueue.sync {
                                audioFinished = true
                                if exportError == nil {
                                    exportError = readerError
                                }
                            }
                            tryFinishWriter()
                            return
                        }
                        audioInput.markAsFinished()
                        syncQueue.sync {
                            audioFinished = true
                        }
                        tryFinishWriter()
                        return
                    }
                    
                    let appendSucceeded = audioInput.append(sampleBuffer)
                    if !appendSucceeded {
                        autoreleasepool {
                            _ = sampleBuffer
                        }
                        assetReader.cancelReading()
                        audioInput.markAsFinished()
                        syncQueue.sync {
                            audioFinished = true
                            if exportError == nil {
                                exportError = assetWriter.error
                            }
                        }
                        tryFinishWriter()
                        return
                    }
                }
            }
        } else {
            syncQueue.sync {
                audioFinished = true
            }
            tryFinishWriter()
        }
        
        let timeout = DispatchTime.now() + .seconds(300)
        let waitResult = semaphore.wait(timeout: timeout)
        
        if waitResult == .timedOut {
            assetReader.cancelReading()
            videoInput.markAsFinished()
            if let audioInput = audioInput {
                audioInput.markAsFinished()
            }
            tryFinishWriter()
            throw MediaUtilsError.videoProcessingFailed("Export timed out after 5 minutes")
        }
        
        assetReader.cancelReading()
        
        let finalError = syncQueue.sync { exportError }
        if let error = finalError {
            throw MediaUtilsError.videoProcessingFailed("Export failed: \(error.localizedDescription)")
        }
        
        guard assetWriter.status == .completed else {
            let statusString = String(describing: assetWriter.status)
            let errorMsg = assetWriter.error?.localizedDescription ?? "Unknown error"
            throw MediaUtilsError.videoProcessingFailed("Export failed with status: \(statusString), error: \(errorMsg)")
        }
        
        guard FileManager.default.fileExists(atPath: outputURL.path) else {
            throw MediaUtilsError.videoProcessingFailed("Output file was not created")
        }
        
        let outputSize = getFileSize(for: outputURL)
        guard outputSize > 0 else {
            throw MediaUtilsError.videoProcessingFailed("Output file is empty")
        }
        
        outputFileCreated = false
    }
    
    private static func getFileSize(for url: URL) -> Int64 {
        do {
            let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
            return attributes[.size] as? Int64 ?? 0
        } catch {
            return 0
        }
    }
    
    private static func scaleDownCGImageSource(_ img: CGImageSource, dstURL: URL, options: CFDictionary) throws {
        guard let scaledRef = CGImageSourceCreateThumbnailAtIndex(img, 0, options) else {
            throw MediaUtilsError.imageProcessingFailed("Failed to create thumbnail")
        }
        
        guard let scaled = UIImage(cgImage: scaledRef).jpegData(compressionQuality: MediaProcessingConfig.imageCompressionQuality) else {
            throw MediaUtilsError.imageProcessingFailed("Failed to create JPEG data")
        }
        
        do {
            try scaled.write(to: dstURL)
        } catch {
            throw MediaUtilsError.fileOperationFailed("Failed to write scaled image: \(error.localizedDescription)")
        }
    }
    
    private static func stripImageExif(at url: URL) throws {
        let cgSource: CGImageSource? = {
            guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else {
                return nil
            }
            return source
        }()
        
        guard let cgSource = cgSource else {
            throw MediaUtilsError.imageProcessingFailed("Failed to create image source")
        }
        
        let type = CGImageSourceGetType(cgSource)
        let count = CGImageSourceGetCount(cgSource)
        let tmpDstURL = url.appendingPathExtension("tmp")
        
        defer {
            // Cleanup temporary file
            try? FileManager.default.removeItem(at: tmpDstURL)
        }
        
        guard let cgDestination = CGImageDestinationCreateWithURL(tmpDstURL as CFURL, type!, count, nil) else {
            throw MediaUtilsError.imageProcessingFailed("Failed to create image destination")
        }
        
        let removeExifProperties = [
            kCGImagePropertyExifDictionary: kCFNull,
            kCGImagePropertyGPSDictionary: kCFNull
        ] as CFDictionary
        
        for index in 0..<count {
            CGImageDestinationAddImageFromSource(cgDestination, cgSource, index, removeExifProperties)
        }
        
        guard CGImageDestinationFinalize(cgDestination) else {
            throw MediaUtilsError.imageProcessingFailed("Failed to finalize image destination")
        }
        
        do {
            try FileManager.default.replaceItem(at: url, withItemAt: tmpDstURL, backupItemName: nil, options: [], resultingItemURL: nil)
        } catch {
            throw MediaUtilsError.fileOperationFailed("Failed to replace original file: \(error.localizedDescription)")
        }
    }
}
