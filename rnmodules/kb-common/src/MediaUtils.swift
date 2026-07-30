import AVFoundation
import Foundation
import ImageIO
import UIKit

struct MediaProcessingConfig {
    static let imageMaxPixelSize: Int = 1200
    static let imageCompressionQuality: CGFloat = 0.85
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

@objc(MediaUtils)
public class MediaUtils: NSObject {
    private static var scaledImageOptions: CFDictionary {
        return [
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceThumbnailMaxPixelSize: MediaProcessingConfig.imageMaxPixelSize,
        ] as CFDictionary
    }

    @objc public static func processImage(
        fromOriginal url: URL,
        compress: Bool,
        completion: @escaping (Error?, URL?) -> Void
    ) {
        processImageAsync(fromOriginal: url, compress: compress) { result in
            switch result {
            case .success(let url):
                completion(nil, url)
            case .failure(let error):
                completion(error, nil)
            }
        }
    }

    static func processImageAsync(
        fromOriginal url: URL,
        compress: Bool,
        completion: @escaping ProcessMediaCompletion
    ) {
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let processedURL = try processImageSync(fromOriginal: url, compress: compress)
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

    private static func processImageSync(fromOriginal url: URL, compress: Bool) throws -> URL {
        // Validate input
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw MediaUtilsError.invalidInput("File does not exist at path: \(url.path)")
        }

        if !compress {
            return url
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

    // edit carries the user's trim range and audio choice; nil means "the whole
    // clip, untouched".
    @objc public static func processVideo(
        fromOriginal url: URL,
        compress: Bool,
        edit: VideoEdit?,
        completion: @escaping (Error?, URL?) -> Void
    ) {
        processVideoAsync(fromOriginal: url, compress: compress, edit: edit) { result in
            switch result {
            case .success(let url):
                completion(nil, url)
            case .failure(let error):
                completion(error, nil)
            }
        }
    }

    static func processVideoAsync(
        fromOriginal url: URL,
        compress: Bool,
        edit: VideoEdit? = nil,
        completion: @escaping ProcessMediaCompletion
    ) {
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let processedURL = try processVideoSync(
                    fromOriginal: url, compress: compress, edit: edit)
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

    private static func processVideoSync(
        fromOriginal url: URL, compress: Bool, edit: VideoEdit?
    ) throws -> URL {
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw MediaUtilsError.invalidInput("File does not exist at path: \(url.path)")
        }

        // Passthrough with nothing to cut means the caller wants the original
        // bytes. Exporting would rewrite the container for no benefit, so hand
        // back the input.
        if !compress && edit == nil {
            return url
        }

        let asset = AVURLAsset(url: url)
        try validateVideoAsset(asset)

        let basename = url.deletingPathExtension().lastPathComponent
        let parent = url.deletingLastPathComponent()
        let processedURL = parent.appendingPathComponent("\(basename).processed.mp4")

        // An edit has to go through a composition, and a composition can't be
        // passthrough-exported reliably, so any edit implies the compressed
        // preset even when the preference says original.
        let source = try edit.map { try composition(from: asset, edit: $0) } ?? asset
        try exportVideoWithSettings(
            asset: source,
            outputURL: processedURL,
            settings: exportSettings(compress: compress || edit != nil))

        return processedURL
    }

    // Builds a video-only or video+audio composition covering the trim range.
    private static func composition(from asset: AVURLAsset, edit: VideoEdit) throws
        -> AVComposition
    {
        let duration = asset.duration
        let range = edit.timeRange(within: duration)
        guard range.duration.seconds > 0 else {
            throw MediaUtilsError.invalidInput("Trim range is empty")
        }

        let composition = AVMutableComposition()

        guard let sourceVideo = asset.tracks(withMediaType: .video).first,
            let videoTrack = composition.addMutableTrack(
                withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)
        else {
            throw MediaUtilsError.videoProcessingFailed("Failed to create composition track")
        }
        try videoTrack.insertTimeRange(range, of: sourceVideo, at: .zero)
        // Without the source transform a portrait clip exports sideways: the
        // rotation lives on the track, not in the pixels.
        videoTrack.preferredTransform = sourceVideo.preferredTransform

        // A silent source is normal; failing to build the track when the user
        // kept audio is not, and swallowing it would upload a silent video.
        if !edit.removeAudio, let sourceAudio = asset.tracks(withMediaType: .audio).first {
            guard
                let audioTrack = composition.addMutableTrack(
                    withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
            else {
                throw MediaUtilsError.videoProcessingFailed("Failed to create audio composition track")
            }
            try audioTrack.insertTimeRange(range, of: sourceAudio, at: .zero)
        }

        return composition
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
            _ = try generator.copyCGImage(
                at: CMTime(seconds: 0, preferredTimescale: 1), actualTime: nil)
        } catch {
            throw MediaUtilsError.videoProcessingFailed(
                "Failed to generate video thumbnail: \(error.localizedDescription)")
        }
    }

    private static func exportSettings(compress: Bool) -> VideoExportSettings {
        // One policy, two outcomes. Callers decide whether to compress; the
        // policy itself never varies by source size. Changing the compressed
        // preset here changes it for both the share extension and in-chat attach.
        return compress ? VideoExportSettings.compressed : VideoExportSettings.passthrough
    }

    private static func exportVideoWithSettings(
        asset: AVAsset,
        outputURL: URL,
        settings: VideoExportSettings
    ) throws {

        let semaphore = DispatchSemaphore(value: 0)
        var exportError: Error?

        guard let exportSession = AVAssetExportSession(asset: asset, presetName: settings.preset)
        else {
            throw MediaUtilsError.videoProcessingFailed("Failed to create export session")
        }

        // AVAssetExportSession refuses to write over an existing file, so a
        // second pass over the same source would fail outright.
        try? FileManager.default.removeItem(at: outputURL)

        exportSession.outputURL = outputURL
        exportSession.outputFileType = .mp4
        exportSession.shouldOptimizeForNetworkUse = true
        exportSession.metadataItemFilter = AVMetadataItemFilter.forSharing()  // Strips location data

        // The 720p preset alone encodes around 11 Mbps, several times what the
        // old picker-driven flow produced. A byte budget is the only bitrate
        // knob AVAssetExportSession exposes, and it only ever lowers quality, so
        // a short or already-small clip is unaffected.
        if let bitsPerSecond = settings.totalBitrate {
            let duration = CMTimeGetSeconds(asset.duration)
            if duration.isFinite && duration > 0 {
                exportSession.fileLengthLimit = Int64(Double(bitsPerSecond) / 8 * duration)
            }
        }

        exportSession.exportAsynchronously {
            exportError = exportSession.error
            semaphore.signal()
        }

        semaphore.wait()

        if let error = exportError {
            throw MediaUtilsError.videoProcessingFailed(
                "Export failed: \(error.localizedDescription)")
        }

        guard exportSession.status == .completed else {
            throw MediaUtilsError.videoProcessingFailed(
                "Export session failed with status: \(exportSession.status)")
        }
    }

    private static func scaleDownCGImageSource(
        _ img: CGImageSource, dstURL: URL, options: CFDictionary
    ) throws {
        guard let scaledRef = CGImageSourceCreateThumbnailAtIndex(img, 0, options) else {
            throw MediaUtilsError.imageProcessingFailed("Failed to create thumbnail")
        }

        guard
            let scaled = UIImage(cgImage: scaledRef).jpegData(
                compressionQuality: MediaProcessingConfig.imageCompressionQuality)
        else {
            throw MediaUtilsError.imageProcessingFailed("Failed to create JPEG data")
        }

        do {
            try scaled.write(to: dstURL)
        } catch {
            throw MediaUtilsError.fileOperationFailed(
                "Failed to write scaled image: \(error.localizedDescription)")
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

        guard
            let cgDestination = CGImageDestinationCreateWithURL(
                tmpDstURL as CFURL, type!, count, nil)
        else {
            throw MediaUtilsError.imageProcessingFailed("Failed to create image destination")
        }

        let removeExifProperties =
            [
                kCGImagePropertyExifDictionary: kCFNull,
                kCGImagePropertyGPSDictionary: kCFNull,
            ] as CFDictionary

        for index in 0..<count {
            CGImageDestinationAddImageFromSource(
                cgDestination, cgSource, index, removeExifProperties)
        }

        guard CGImageDestinationFinalize(cgDestination) else {
            throw MediaUtilsError.imageProcessingFailed("Failed to finalize image destination")
        }

        do {
            try FileManager.default.replaceItem(
                at: url, withItemAt: tmpDstURL, backupItemName: nil, options: [],
                resultingItemURL: nil)
        } catch {
            throw MediaUtilsError.fileOperationFailed(
                "Failed to replace original file: \(error.localizedDescription)")
        }
    }
}

// A user's edit of one clip. Milliseconds because that's what crosses the JS
// bridge; an end of 0 (or past the source) means "to the end".
@objc(VideoEdit)
public class VideoEdit: NSObject {
    let startMs: Int
    let endMs: Int
    let removeAudio: Bool

    @objc public init(startMs: Int, endMs: Int, removeAudio: Bool) {
        self.startMs = max(0, startMs)
        self.endMs = max(0, endMs)
        self.removeAudio = removeAudio
        super.init()
    }

    // Nothing trimmed and audio kept means there is no edit at all, so callers
    // can skip the composition and the forced re-encode.
    @objc public var isNoop: Bool {
        return removeAudio == false && startMs == 0 && endMs == 0
    }

    func timeRange(within duration: CMTime) -> CMTimeRange {
        let scale: CMTimeScale = 1000
        let total = duration.isNumeric ? duration : .zero
        let start = CMTime(value: CMTimeValue(startMs), timescale: scale)
        let requestedEnd = CMTime(value: CMTimeValue(endMs), timescale: scale)
        let end =
            (endMs == 0 || CMTimeCompare(requestedEnd, total) > 0) ? total : requestedEnd
        guard CMTimeCompare(start, end) < 0 else {
            return CMTimeRange(start: .zero, duration: total)
        }
        return CMTimeRange(start: start, end: end)
    }
}

struct VideoExportSettings {
    let preset: String
    // Video + audio combined, in bits per second. nil leaves the preset's own
    // bitrate alone.
    let totalBitrate: Int?

    static let passthrough = VideoExportSettings(
        preset: AVAssetExportPresetPassthrough, totalBitrate: nil)
    // 720p at ~3.9 Mbps reproduces what the old picker-driven flow produced:
    // a 28s 1080p/60 clip lands around 13 MB either way.
    static let compressed = VideoExportSettings(
        preset: AVAssetExportPreset1280x720, totalBitrate: 3_900_000)
}
