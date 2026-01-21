import Foundation
import AVFoundation
import UIKit
import ImageIO

struct MediaProcessingConfig {
    static let imageMaxPixelSize: Int = 1200
    static let imageCompressionQuality: CGFloat = 0.85
    static let videoMaxPixels: Int = 1280 * 720
    static let videoMaxFileSize: Int64 = 50 * 1024 * 1024
    static let videoMaxFrameRate: Int32 = 30
    static let videoMaxBitrate: Int = 4 * 1000 * 1000
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
        
        guard let cgSource = CGImageSourceCreateWithURL(url as CFURL, nil) else {
            throw MediaUtilsError.imageProcessingFailed("Failed to create image source")
        }
        
        try scaleDownCGImageSource(cgSource, dstURL: scaledURL, options: scaledImageOptions)
        return scaledURL
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
        
        let exportSettings = determineOptimalExportSettings(for: asset)
        
        try exportVideoWithSettings(asset: asset,
                                   outputURL: processedURL,
                                   settings: exportSettings,
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
    
    private static func determineOptimalExportSettings(for asset: AVURLAsset) -> VideoExportSettings {
        let videoTracks = asset.tracks(withMediaType: .video)
        guard let firstVideoTrack = videoTracks.first else {
            return VideoExportSettings.default
        }
        
        let preferredTransform = firstVideoTrack.preferredTransform
        let naturalSize = firstVideoTrack.naturalSize
        let actualSize = naturalSize.applying(preferredTransform)
        let width = abs(actualSize.width)
        let height = abs(actualSize.height)
        let pixelCount = Int(width * height)
        let fileSize = getFileSize(for: asset.url)
        
        let needsScaling = pixelCount > MediaProcessingConfig.videoMaxPixels ||
                          fileSize > MediaProcessingConfig.videoMaxFileSize
        
        if needsScaling {
            let (newWidth, newHeight) = calculateOutputDimensions(width: width, height: height, maxPixels: MediaProcessingConfig.videoMaxPixels)
            let targetSize = CGSize(width: CGFloat(newWidth), height: CGFloat(newHeight))
            let trackFrameRate = firstVideoTrack.nominalFrameRate
            let maxFrameRate: Int32? = trackFrameRate > Float(MediaProcessingConfig.videoMaxFrameRate) ? MediaProcessingConfig.videoMaxFrameRate : nil
            return VideoExportSettings(preset: AVAssetExportPresetHighestQuality, targetSize: targetSize, maxFrameRate: maxFrameRate)
        } else {
            let trackFrameRate = firstVideoTrack.nominalFrameRate
            let maxFrameRate: Int32? = trackFrameRate > Float(MediaProcessingConfig.videoMaxFrameRate) ? MediaProcessingConfig.videoMaxFrameRate : nil
            if maxFrameRate != nil {
                return VideoExportSettings(preset: AVAssetExportPresetPassthrough, targetSize: nil, maxFrameRate: maxFrameRate)
            } else {
                return VideoExportSettings.passthrough
            }
        }
    }
    
    private static func buildVideoComposition(for asset: AVURLAsset, settings: VideoExportSettings) -> AVMutableVideoComposition? {
        let videoTracks = asset.tracks(withMediaType: .video)
        guard let videoTrack = videoTracks.first else {
            return nil
        }
        
        let naturalSize = videoTrack.naturalSize
        let preferredTransform = videoTrack.preferredTransform
        let displaySize = naturalSize.applying(preferredTransform)
        let displayWidth = abs(displaySize.width)
        let displayHeight = abs(displaySize.height)
        
        var targetDisplaySize: CGSize?
        var maxFrameRate: Int32?
        
        if let settingsTargetSize = settings.targetSize {
            targetDisplaySize = settingsTargetSize
        } else {
            let pixelCount = Int(displayWidth * displayHeight)
            if pixelCount > MediaProcessingConfig.videoMaxPixels {
                let (newWidth, newHeight) = calculateOutputDimensions(width: displayWidth, height: displayHeight, maxPixels: MediaProcessingConfig.videoMaxPixels)
                targetDisplaySize = CGSize(width: CGFloat(newWidth), height: CGFloat(newHeight))
            }
        }
        
        if let settingsMaxFrameRate = settings.maxFrameRate {
            maxFrameRate = settingsMaxFrameRate
        } else {
            let trackFrameRate = videoTrack.nominalFrameRate
            if trackFrameRate > Float(MediaProcessingConfig.videoMaxFrameRate) {
                maxFrameRate = MediaProcessingConfig.videoMaxFrameRate
            }
        }
        
        guard targetDisplaySize != nil || maxFrameRate != nil else {
            return nil
        }
        
        let composition = AVMutableVideoComposition()
        
        let finalRenderSize: CGSize
        if let targetDisplaySize = targetDisplaySize {
            finalRenderSize = targetDisplaySize
        } else {
            finalRenderSize = CGSize(width: displayWidth, height: displayHeight)
        }
        composition.renderSize = finalRenderSize
        composition.frameDuration = CMTime(value: 1, timescale: maxFrameRate ?? Int32(videoTrack.nominalFrameRate))
        
        let instruction = AVMutableVideoCompositionInstruction()
        instruction.timeRange = CMTimeRange(start: .zero, duration: asset.duration)
        
        let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: videoTrack)
        
        if let targetDisplaySize = targetDisplaySize {
            let scale = min(targetDisplaySize.width / displayWidth, targetDisplaySize.height / displayHeight)
            let scaleTransform = CGAffineTransform(scaleX: scale, y: scale)
            let finalTransform = scaleTransform.concatenating(preferredTransform)
            layerInstruction.setTransform(finalTransform, at: .zero)
        } else {
            layerInstruction.setTransform(preferredTransform, at: .zero)
        }
        
        instruction.layerInstructions = [layerInstruction]
        composition.instructions = [instruction]
        
        return composition
    }
    
    private static func exportVideoWithSettings(asset: AVURLAsset,
                                              outputURL: URL,
                                              settings: VideoExportSettings,
                                              progress: ProcessMediaProgressCallback?) throws {
        
        let videoComposition = buildVideoComposition(for: asset, settings: settings)
        
        if videoComposition != nil {
            do {
                try exportVideoWithWriter(asset: asset,
                                        outputURL: outputURL,
                                        videoComposition: videoComposition!,
                                        progress: progress)
            } catch {
                try exportVideoWithSession(asset: asset,
                                         outputURL: outputURL,
                                         settings: settings,
                                         videoComposition: videoComposition,
                                         progress: progress)
            }
        } else {
            try exportVideoWithSession(asset: asset,
                                     outputURL: outputURL,
                                     settings: settings,
                                     videoComposition: nil,
                                     progress: progress)
        }
    }
    
    private static func exportVideoWithSession(asset: AVURLAsset,
                                             outputURL: URL,
                                             settings: VideoExportSettings,
                                             videoComposition: AVMutableVideoComposition?,
                                             progress: ProcessMediaProgressCallback?) throws {
        let semaphore = DispatchSemaphore(value: 0)
        var exportError: Error?
        
        guard let exportSession = AVAssetExportSession(asset: asset, presetName: settings.preset) else {
            throw MediaUtilsError.videoProcessingFailed("Failed to create export session")
        }
        
        exportSession.outputURL = outputURL
        exportSession.outputFileType = .mp4
        exportSession.shouldOptimizeForNetworkUse = true
        exportSession.metadataItemFilter = AVMetadataItemFilter.forSharing()
        
        if let videoComposition = videoComposition {
            exportSession.videoComposition = videoComposition
        }
        
        if let progress = progress {
            let timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in
                DispatchQueue.main.async {
                    progress(exportSession.progress)
                }
            }
            
            exportSession.exportAsynchronously {
                timer.invalidate()
                exportError = exportSession.error
                semaphore.signal()
            }
        } else {
            exportSession.exportAsynchronously {
                exportError = exportSession.error
                semaphore.signal()
            }
        }
        
        semaphore.wait()
        
        if let error = exportError {
            throw MediaUtilsError.videoProcessingFailed("Export failed: \(error.localizedDescription)")
        }
        
        guard exportSession.status == .completed else {
            throw MediaUtilsError.videoProcessingFailed("Export session failed with status: \(exportSession.status)")
        }
    }
    
    private static func exportVideoWithWriter(asset: AVURLAsset,
                                            outputURL: URL,
                                            videoComposition: AVMutableVideoComposition,
                                            progress: ProcessMediaProgressCallback?) throws {
        let videoTracks = asset.tracks(withMediaType: .video)
        guard !videoTracks.isEmpty else {
            throw MediaUtilsError.videoProcessingFailed("No video track found")
        }
        
        let audioTracks = asset.tracks(withMediaType: .audio)
        
        guard let writer = try? AVAssetWriter(outputURL: outputURL, fileType: .mp4) else {
            throw MediaUtilsError.videoProcessingFailed("Failed to create asset writer")
        }
        
        let videoSettings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: Int(videoComposition.renderSize.width),
            AVVideoHeightKey: Int(videoComposition.renderSize.height),
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: MediaProcessingConfig.videoMaxBitrate,
                AVVideoMaxKeyFrameIntervalKey: 30,
                AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
            ]
        ]
        
        let videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
        videoInput.expectsMediaDataInRealTime = false
        
        guard writer.canAdd(videoInput) else {
            throw MediaUtilsError.videoProcessingFailed("Cannot add video input to writer")
        }
        writer.add(videoInput)
        
        var audioInput: AVAssetWriterInput?
        if !audioTracks.isEmpty, let audioTrack = audioTracks.first {
            let audioSettings: [String: Any] = [
                AVFormatIDKey: kAudioFormatMPEG4AAC,
                AVSampleRateKey: 44100,
                AVNumberOfChannelsKey: 2,
                AVEncoderBitRateKey: 128000
            ]
            
            let input = AVAssetWriterInput(mediaType: .audio, outputSettings: audioSettings)
            input.expectsMediaDataInRealTime = false
            
            if writer.canAdd(input) {
                writer.add(input)
                audioInput = input
            }
        }
        
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: videoInput, sourcePixelBufferAttributes: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey as String: Int(videoComposition.renderSize.width),
            kCVPixelBufferHeightKey as String: Int(videoComposition.renderSize.height)
        ])
        
        guard writer.startWriting() else {
            throw MediaUtilsError.videoProcessingFailed("Failed to start writing: \(writer.error?.localizedDescription ?? "Unknown error")")
        }
        
        writer.startSession(atSourceTime: .zero)
        
        let reader = try AVAssetReader(asset: asset)
        reader.timeRange = CMTimeRange(start: .zero, duration: asset.duration)
        
        let videoReaderOutput = AVAssetReaderVideoCompositionOutput(videoTracks: videoTracks, videoSettings: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ])
        videoReaderOutput.videoComposition = videoComposition
        videoReaderOutput.alwaysCopiesSampleData = false
        
        guard reader.canAdd(videoReaderOutput) else {
            throw MediaUtilsError.videoProcessingFailed("Cannot add video output to reader")
        }
        reader.add(videoReaderOutput)
        
        var audioReaderOutput: AVAssetReaderTrackOutput?
        if let audioInput = audioInput, let audioTrack = audioTracks.first {
            let output = AVAssetReaderTrackOutput(track: audioTrack, outputSettings: nil)
            if reader.canAdd(output) {
                reader.add(output)
                audioReaderOutput = output
            }
        }
        
        guard reader.startReading() else {
            throw MediaUtilsError.videoProcessingFailed("Failed to start reading: \(reader.error?.localizedDescription ?? "Unknown error")")
        }
        
        let semaphore = DispatchSemaphore(value: 0)
        var processingError: Error?
        let processingQueue = DispatchQueue(label: "video.processing")
        let duration = asset.duration
        var videoFinished = false
        var audioFinished = false
        
        func checkCompletion() {
            if videoFinished && (audioInput == nil || audioFinished) {
                writer.finishWriting {
                    semaphore.signal()
                }
            }
        }
        
        processingQueue.async {
            videoInput.requestMediaDataWhenReady(on: processingQueue) {
                while videoInput.isReadyForMoreMediaData && !videoFinished {
                    guard let sampleBuffer = videoReaderOutput.copyNextSampleBuffer() else {
                        videoInput.markAsFinished()
                        videoFinished = true
                        checkCompletion()
                        break
                    }
                    
                    guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
                        CMSampleBufferInvalidate(sampleBuffer)
                        continue
                    }
                    
                    let presentationTime = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
                    
                    if !adaptor.append(pixelBuffer, withPresentationTime: presentationTime) {
                        if let error = writer.error {
                            processingError = error
                        }
                        videoInput.markAsFinished()
                        videoFinished = true
                        checkCompletion()
                        break
                    }
                    
                    if let progress = progress {
                        let progressValue = Float(CMTimeGetSeconds(presentationTime) / CMTimeGetSeconds(duration))
                        DispatchQueue.main.async {
                            progress(progressValue)
                        }
                    }
                    
                    CMSampleBufferInvalidate(sampleBuffer)
                }
            }
            
            if let audioInput = audioInput, let audioReaderOutput = audioReaderOutput {
                audioInput.requestMediaDataWhenReady(on: processingQueue) {
                    while audioInput.isReadyForMoreMediaData && !audioFinished {
                        guard let sampleBuffer = audioReaderOutput.copyNextSampleBuffer() else {
                            audioInput.markAsFinished()
                            audioFinished = true
                            checkCompletion()
                            break
                        }
                        
                        if !audioInput.append(sampleBuffer) {
                            if let error = writer.error {
                                processingError = error
                            }
                            audioInput.markAsFinished()
                            audioFinished = true
                            checkCompletion()
                            break
                        }
                    }
                }
            }
        }
        
        semaphore.wait()
        
        if let error = processingError ?? writer.error {
            throw MediaUtilsError.videoProcessingFailed("Export failed: \(error.localizedDescription)")
        }
        
        guard writer.status == .completed else {
            throw MediaUtilsError.videoProcessingFailed("Writer failed with status: \(writer.status)")
        }
    }
    
    private static func getFileSize(for url: URL) -> Int64 {
        do {
            let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
            return attributes[.size] as? Int64 ?? 0
        } catch {
            return 0
        }
    }
    
    private static func calculateOutputDimensions(width: CGFloat, height: CGFloat, maxPixels: Int) -> (width: Int, height: Int) {
        let pixelCount = Int(width * height)
        if pixelCount <= maxPixels {
            return (Int(width), Int(height))
        }
        
        let scale = sqrt(Double(maxPixels) / Double(pixelCount))
        var newWidth = Int(width * scale)
        var newHeight = Int(height * scale)
        
        if newWidth % 2 != 0 {
            newWidth -= 1
        }
        if newHeight % 2 != 0 {
            newHeight -= 1
        }
        
        return (newWidth, newHeight)
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
        guard let cgSource = CGImageSourceCreateWithURL(url as CFURL, nil) else {
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

struct VideoExportSettings {
    let preset: String
    let targetSize: CGSize?
    let maxFrameRate: Int32?
    
    init(preset: String, targetSize: CGSize? = nil, maxFrameRate: Int32? = nil) {
        self.preset = preset
        self.targetSize = targetSize
        self.maxFrameRate = maxFrameRate
    }
    
    static let passthrough = VideoExportSettings(preset: AVAssetExportPresetPassthrough)
    static let highQuality = VideoExportSettings(preset: AVAssetExportPreset1920x1080)
    static let mediumQuality = VideoExportSettings(preset: AVAssetExportPresetMediumQuality)
    static let lowQuality = VideoExportSettings(preset: AVAssetExportPresetLowQuality)
    
    static let `default` = mediumQuality
}
