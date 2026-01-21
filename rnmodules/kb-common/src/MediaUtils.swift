import Foundation
import AVFoundation
import UIKit
import ImageIO
import ObjectiveC.runtime

struct MediaProcessingConfig {
    static let imageMaxPixelSize: Int = 1200
    static let imageCompressionQuality: CGFloat = 0.85
    static let videoMaxPixels: Int = 1920 * 1080
    static let videoMaxFileSize: Int64 = 50 * 1024 * 1024
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
class MediaUtils: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    private static var scaledImageOptions: CFDictionary {
        return [
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceThumbnailMaxPixelSize: MediaProcessingConfig.imageMaxPixelSize
        ] as CFDictionary
    }
    
    private static var videoPickerCompletion: ((Error?, URL?) -> Void)?
    private static var videoPickerInstance: MediaUtils?
    
    private static func getRootViewController() -> UIViewController? {
        // UIApplication.shared is not available in app extensions at compile time
        // Use fully runtime-based approach with objc_msgSend to avoid compile errors
        guard let applicationClass: AnyClass = NSClassFromString("UIApplication") else {
            return nil
        }
        
        let sharedApplicationSelector = NSSelectorFromString("sharedApplication")
        
        // Use objc_msgSend to call the method at runtime
        typealias SharedApplicationMethod = @convention(c) (AnyClass, Selector) -> Unmanaged<AnyObject>
        let methodImplementation = class_getClassMethod(applicationClass, sharedApplicationSelector)
        guard let imp = methodImplementation else {
            return nil
        }
        
        let method = unsafeBitCast(method_getImplementation(imp), to: SharedApplicationMethod.self)
        let unmanaged = method(applicationClass, sharedApplicationSelector)
        let sharedApp = unmanaged.takeUnretainedValue() as? NSObject
        
        guard let sharedApp = sharedApp else {
            return nil
        }
        
        if #available(iOS 13.0, *) {
            // Use KVC to access connectedScenes to avoid compile-time references
            if let scenes = sharedApp.value(forKey: "connectedScenes") as? NSSet,
               let scene = scenes.anyObject() as? NSObject,
               let windows = scene.value(forKey: "windows") as? NSArray,
               let window = windows.firstObject as? UIWindow {
                return window.rootViewController
            }
        } else {
            // Fallback for iOS < 13
            if let keyWindow = sharedApp.value(forKey: "keyWindow") as? UIWindow {
                return keyWindow.rootViewController
            }
        }
        
        return nil
    }
    
    @objc static func showVideoPickerForCompression(completion: @escaping (Error?, URL?) -> Void) {
        DispatchQueue.main.async {
            // Check if we're in an app extension
            if Bundle.main.bundlePath.hasSuffix(".appex") {
                completion(MediaUtilsError.invalidInput("Video picker is not available in app extensions"), nil)
                return
            }
            
            guard let rootViewController = getRootViewController() else {
                completion(MediaUtilsError.invalidInput("No root view controller found"), nil)
                return
            }
            
            let picker = UIImagePickerController()
            picker.sourceType = .photoLibrary
            picker.mediaTypes = ["public.movie"]
            picker.allowsEditing = true
            picker.videoQuality = .typeMedium
            picker.videoExportPreset = AVAssetExportPresetMediumQuality
            
            let instance = MediaUtils()
            videoPickerInstance = instance
            videoPickerCompletion = completion
            picker.delegate = instance
            
            // Present on the topmost view controller to ensure it's visible
            var topController = rootViewController
            while let presented = topController.presentedViewController {
                topController = presented
            }
            topController.present(picker, animated: true, completion: nil)
        }
    }
    
    func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
        picker.dismiss(animated: true) {
            // For videos, when allowsEditing is true, the edited video URL is in .mediaURL
            // There is no separate .editedMediaURL key for videos (that's only for images)
            let mediaURLKey = UIImagePickerController.InfoKey.mediaURL
            
            if let videoURL = info[mediaURLKey] as? URL {
                MediaUtils.videoPickerCompletion?(nil, videoURL)
            } else {
                MediaUtils.videoPickerCompletion?(MediaUtilsError.videoProcessingFailed("No video URL found"), nil)
            }
            MediaUtils.videoPickerCompletion = nil
            MediaUtils.videoPickerInstance = nil
        }
    }
    
    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true) {
            MediaUtils.videoPickerCompletion?(MediaUtilsError.videoProcessingFailed("User cancelled video selection"), nil)
            MediaUtils.videoPickerCompletion = nil
            MediaUtils.videoPickerInstance = nil
        }
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
        
        // Check if we can use passthrough (return original without export)
        let exportSettings = determineOptimalExportSettings(for: asset)
        
        if exportSettings == nil {
            // Passthrough: return original file without re-encoding
            // Similar to expo-image-picker's behavior when videoExportPreset is Passthrough
            // and no editing/trimming is needed
            return url
        }
        
        let basename = url.deletingPathExtension().lastPathComponent
        let parent = url.deletingLastPathComponent()
        let processedURL = parent.appendingPathComponent("\(basename).processed.mp4")
        
        try exportVideoWithSettings(asset: asset,
                                   outputURL: processedURL,
                                   settings: exportSettings!,
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
    
    private static func determineOptimalExportSettings(for asset: AVURLAsset) -> VideoExportSettings? {
        let videoTracks = asset.tracks(withMediaType: .video)
        guard let firstVideoTrack = videoTracks.first else {
            return VideoExportSettings.default
        }
        
        let size = firstVideoTrack.naturalSize
        let pixelCount = Int(size.width * size.height)
        let fileSize = getFileSize(for: asset.url)
        
        // Determine if we need to scale down
        let needsScaling = pixelCount > MediaProcessingConfig.videoMaxPixels ||
                          fileSize > MediaProcessingConfig.videoMaxFileSize
        
        if needsScaling {
            // Match expo-image-picker's compression behavior
            // Expo uses videoQuality: Medium which compresses more aggressively
            // Use resolution-based presets to match expo's file sizes
            if pixelCount > 1920 * 1080 {
                // For 4K or larger, scale down to 720p (matches expo's aggressive compression)
                return VideoExportSettings.h264_1280x720
            } else if pixelCount > 1280 * 720 {
                // For 1080p, use medium quality (expo's default videoQuality: Medium)
                return VideoExportSettings.mediumQuality
            } else if fileSize > MediaProcessingConfig.videoMaxFileSize {
                // If file size is large but resolution is OK, still compress
                return VideoExportSettings.mediumQuality
            } else {
                return VideoExportSettings.mediumQuality
            }
        } else {
            // Passthrough: return nil to indicate no export needed
            // This matches expo-image-picker's behavior when videoExportPreset is Passthrough
            // and allowsEditing is false - return original asset without re-encoding
            return nil
        }
    }
    
    private static func exportVideoWithSettings(asset: AVURLAsset,
                                              outputURL: URL,
                                              settings: VideoExportSettings,
                                              progress: ProcessMediaProgressCallback?) throws {
        
        let semaphore = DispatchSemaphore(value: 0)
        var exportError: Error?
        
        guard let exportSession = AVAssetExportSession(asset: asset, presetName: settings.preset) else {
            throw MediaUtilsError.videoProcessingFailed("Failed to create export session")
        }
        
        exportSession.outputURL = outputURL
        exportSession.outputFileType = .mp4
        // Match expo-image-picker: shouldOptimizeForNetworkUse helps reduce file size
        // by optimizing encoding for streaming/network transfer (more aggressive compression)
        exportSession.shouldOptimizeForNetworkUse = true
        exportSession.metadataItemFilter = AVMetadataItemFilter.forSharing() // Strips location data
        
        // Set up progress monitoring
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
    
    static let passthrough = VideoExportSettings(preset: AVAssetExportPresetPassthrough)
    static let highestQuality = VideoExportSettings(preset: AVAssetExportPresetHighestQuality)
    static let highQuality = VideoExportSettings(preset: AVAssetExportPreset1920x1080)
    static let mediumQuality = VideoExportSettings(preset: AVAssetExportPresetMediumQuality)
    static let lowQuality = VideoExportSettings(preset: AVAssetExportPresetLowQuality)
    static let h264_1280x720 = VideoExportSettings(preset: AVAssetExportPreset1280x720)
    static let h264_640x480 = VideoExportSettings(preset: AVAssetExportPreset640x480)
    
    static let `default` = mediumQuality
}
