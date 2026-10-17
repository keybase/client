import AVFoundation
import Foundation
import ImageIO
import UniformTypeIdentifiers
import os

private let log = Logger(subsystem: "com.keybase.app", category: "media-utils")

struct MediaProcessingConfig {
    // Images keep their original dimensions: 6.6.3's in-chat attach re-encoded at
    // this quality without resizing, and downscaling to a thumbnail-sized long
    // edge is the visible regression users noticed when the share extension's
    // policy took over both flows.
    static let imageCompressionQuality: CGFloat = 0.4
    // Higher than imageCompressionQuality: with compression off this is a format
    // conversion, not a size reduction.
    static let transcodeQuality: CGFloat = 0.85
}

enum MediaUtilsError: Error, LocalizedError {
    case fileMissing(String)
    case unrecognizedImageFormat
    case invalidInput(String)
    case imageProcessingFailed(String)
    case videoProcessingFailed(String)
    case fileOperationFailed(String)

    var errorDescription: String? {
        switch self {
        case .fileMissing(let path): return "Invalid input: File does not exist at path: \(path)"
        case .unrecognizedImageFormat: return "Image processing failed: Unrecognized image format"
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
    // The code the JS bridge rejects a failed processImage/processVideo with, so
    // the app can tell the user why without parsing the message. Kept in step with
    // ProcessErrorCode in shared/util/media-process.tsx.
    @objc public static func rejectCode(for error: Error) -> String {
        switch error as? MediaUtilsError {
        case .fileMissing: return "media_missing"
        case .unrecognizedImageFormat: return "media_unrecognized"
        default: return "process_media_error"
        }
    }

    // No max pixel size, so this decodes at full resolution; it stays a thumbnail
    // request only because that's the call that bakes the EXIF orientation into
    // the pixels, which the re-encoded JPEG no longer carries as metadata.
    private static var fullSizeImageOptions: CFDictionary {
        return [
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceCreateThumbnailFromImageAlways: true,
        ] as CFDictionary
    }

    // stripLocation is for Send original after a compressed run: with compress
    // off, an image that would go as it is must carry no location, so it is
    // stripped, or else converted to a JPEG, or else this fails. "Keep full size"
    // passes false and gets the original with its metadata.
    @objc public static func processImage(
        fromOriginal url: URL,
        compress: Bool,
        stripLocation: Bool,
        completion: @escaping (Error?, URL?) -> Void
    ) {
        processImageAsync(fromOriginal: url, compress: compress, stripLocation: stripLocation) {
            result in
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
        stripLocation: Bool = false,
        completion: @escaping ProcessMediaCompletion
    ) {
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let processedURL = try processImageSync(
                    fromOriginal: url, compress: compress, stripLocation: stripLocation)
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

    private static func processImageSync(
        fromOriginal url: URL, compress: Bool, stripLocation: Bool
    ) throws -> URL {
        // Validate input
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw MediaUtilsError.fileMissing(url.path)
        }

        // "Keep full size" is a raw share: the original bytes with their original
        // metadata, which is what the settings screen promises. The exception is
        // a format recipients may not be able to show, which always goes out as
        // a full-size JPEG. A file this device's ImageIO can't identify (a newer
        // RAW, jxl before iOS 17) is an error, not a raw share: Send original
        // takes this path too, and must not upload a location it can't strip.
        // An animation goes as it is too, like a gif, since the JPEG would keep
        // one frame, but only once it carries no location, even here: an
        // animated webp/avif from the share extension went as a metadata-free
        // JPEG before, and this path can't tell it from an in-app pick. With
        // stripLocation, any image that would go as it is goes only once it
        // carries no location. One the strip can't clean becomes a JPEG instead.
        if !compress {
            guard let cgSource = CGImageSourceCreateWithURL(url as CFURL, nil),
                let typeID = CGImageSourceGetType(cgSource)
            else {
                throw MediaUtilsError.unrecognizedImageFormat
            }
            if let type = UTType(typeID as String) {
                let animated = isAnimation(cgSource, type: type)
                if animated || !mustTranscode(type),
                    (!stripLocation && !animated) || removeLocation(at: url)
                {
                    return url
                }
            }
            let basename = url.deletingPathExtension().lastPathComponent
            // Not "<basename>.jpg": a sibling with that name may be another attachment.
            let jpegURL = url.deletingLastPathComponent()
                .appendingPathComponent("\(basename).converted.jpg")
            try recompressCGImageSource(
                cgSource, dstURL: jpegURL, options: fullSizeImageOptions,
                quality: MediaProcessingConfig.transcodeQuality)
            return jpegURL
        }

        // The source is stripped in place, not only the output: after a failure
        // Send original uploads what compress off returns, which for a send-as-is
        // type is the source itself. Best effort, since ImageIO can read some files
        // it can't rewrite (webp, RAW, a 10-bit AVIF on iOS). Those still get their
        // JPEG here, and Send original (stripLocation) checks again and converts
        // anything still carrying a location.
        do {
            try stripImageExif(at: url)
        } catch {
            log.warning(
                "stripImageExif failed for \(url.path, privacy: .private): \(error.localizedDescription, privacy: .private)"
            )
        }

        // Re-encode at the shared quality. Same dimensions, JPEG out, so a HEIC
        // pick still lands as something every platform can render. The encode
        // writes pixels only, so EXIF and GPS from the source never reach it.
        let basename = url.deletingPathExtension().lastPathComponent
        let parent = url.deletingLastPathComponent()
        let compressedURL = parent.appendingPathComponent("\(basename).compressed.jpg")

        guard let cgSource = CGImageSourceCreateWithURL(url as CFURL, nil) else {
            throw MediaUtilsError.imageProcessingFailed("Failed to create image source")
        }
        guard let typeID = CGImageSourceGetType(cgSource) else {
            throw MediaUtilsError.unrecognizedImageFormat
        }

        // An animation goes as it is, like a gif, once it carries no location;
        // the JPEG would keep one frame.
        if let type = UTType(typeID as String), isAnimation(cgSource, type: type), !hasLocation(url) {
            return url
        }

        try recompressCGImageSource(
            cgSource, dstURL: compressedURL, options: fullSizeImageOptions,
            quality: MediaProcessingConfig.imageCompressionQuality)
        return compressedURL
    }

    // Images that may be sent as they are. Everything else (bmp, TIFF, RAW,
    // webp, avif, heif) is transcoded even with compression off. The JS side sends
    // every processable image here and leaves this call to us. Each of these should
    // be a type the GPS strip can rewrite in place, since Send original uploads them
    // as they are once stripped (and as a JPEG when it can't strip one). public.heic
    // is, public.heif is not, and the two don't conform to each other.
    private static let sendAsIsImageTypes: [UTType] = [.jpeg, .png, .gif, .heic]

    private static func mustTranscode(_ type: UTType) -> Bool {
        return !sendAsIsImageTypes.contains(where: { type.conforms(to: $0) })
    }

    // Formats besides GIF whose frames can be an animation. A multi-page TIFF or an
    // MPO also has several images, but those aren't animations.
    private static let animatableImageTypes: [String] = [
        "public.png", "org.webmproject.webp", "public.avif", "public.avis",
        "public.heic", "public.heics",
    ]

    // Where each animated format keeps a frame's delay. Several images alone don't
    // make an animation: a HEIC can hold several primary images (a collection, a
    // burst written as one file), and those carry no delay. AVIS has no key
    // constants of its own; ImageIO uses the same "DelayTime" and
    // "UnclampedDelayTime" names in every format.
    private static let frameDelayKeys: [(CFString, [CFString])] = {
        var keys: [(CFString, [CFString])] = [
            (kCGImagePropertyPNGDictionary, [kCGImagePropertyAPNGDelayTime, kCGImagePropertyAPNGUnclampedDelayTime]),
            (kCGImagePropertyWebPDictionary, [kCGImagePropertyWebPDelayTime, kCGImagePropertyWebPUnclampedDelayTime]),
            (kCGImagePropertyHEICSDictionary, [kCGImagePropertyHEICSDelayTime, kCGImagePropertyHEICSUnclampedDelayTime]),
        ]
        // The pod builds for an older iOS than the app, which needs 16.4.
        if #available(iOS 16.0, *) {
            keys.append(
                (kCGImagePropertyAVISDictionary, [kCGImagePropertyHEICSDelayTime, kCGImagePropertyHEICSUnclampedDelayTime]))
        }
        return keys
    }()

    // More than one frame, one of the first two with a frame delay, read from the
    // container without decoding any. The second is read too: an APNG's default
    // image can sit outside the animation, and a sequence's first frame need not
    // carry a delay. Several frames in a GIF are always an animation, and a
    // frame's delay is optional there (its Graphic Control Extension is).
    private static func isAnimation(_ source: CGImageSource, type: UTType) -> Bool {
        guard CGImageSourceGetCount(source) > 1 else { return false }
        if type.conforms(to: .gif) { return true }
        guard animatableImageTypes.contains(where: { UTType($0).map(type.conforms) ?? false }) else {
            return false
        }
        return (0..<2).contains { index in
            guard let frame = CGImageSourceCopyPropertiesAtIndex(source, index, nil) as? [CFString: Any]
            else { return false }
            return frameDelayKeys.contains { dictionary, keys in
                guard let properties = frame[dictionary] as? [CFString: Any] else { return false }
                return keys.contains { properties[$0] != nil }
            }
        }
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
            throw MediaUtilsError.fileMissing(url.path)
        }

        // "Keep full size" is a raw share: hand the original back untouched. An
        // export purely to re-write the same samples would put a full-size
        // duplicate next to the source, and a multi-GB share fills the disk
        // before it ever uploads.
        if !compress, edit == nil {
            return url
        }

        let asset = AVURLAsset(url: url)
        try validateVideoAsset(asset)

        let basename = url.deletingPathExtension().lastPathComponent
        let parent = url.deletingLastPathComponent()
        let processedURL = parent.appendingPathComponent("\(basename).processed.mp4")

        // An edit has to go through a composition, and a composition can't be
        // passthrough-exported reliably, so a trim re-encodes even when the
        // preference says full size.
        let source = try edit.map { try composition(from: asset, edit: $0) } ?? asset
        try exportVideoWithSettings(
            asset: source, outputURL: processedURL, settings: .compressed)

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

    private static func recompressCGImageSource(
        _ img: CGImageSource, dstURL: URL, options: CFDictionary, quality: CGFloat
    ) throws {
        let image = try decodeForJPEG(img, options: options)

        guard
            let destination = CGImageDestinationCreateWithURL(
                dstURL as CFURL, UTType.jpeg.identifier as CFString, 1, nil)
        else {
            throw MediaUtilsError.fileOperationFailed("Failed to create JPEG destination")
        }
        CGImageDestinationAddImage(
            destination, image,
            [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
        guard CGImageDestinationFinalize(destination) else {
            try? FileManager.default.removeItem(at: dstURL)
            throw MediaUtilsError.imageProcessingFailed("Failed to create JPEG data")
        }
    }

    // Its own function so the full-size decode, which can be several times the
    // 8-bit copy for a deep image, is released before the encode starts.
    private static func decodeForJPEG(_ img: CGImageSource, options: CFDictionary) throws
        -> CGImage
    {
        guard CGImageSourceGetStatusAtIndex(img, 0) == .statusComplete else {
            throw MediaUtilsError.imageProcessingFailed("Image is incomplete")
        }
        guard let decoded = CGImageSourceCreateThumbnailAtIndex(img, 0, options) else {
            throw MediaUtilsError.imageProcessingFailed("Failed to decode image")
        }
        return try jpegEncodable(decoded)
    }

    // The JPEG encoder is only ever given plain 8-bit RGB or gray. A decoder can
    // hand back other layouts (10-bit packed RGB from an AVIF, 16-bit or float
    // from deep TIFF, DNG or HDR, CMYK), so those are redrawn into an 8-bit RGB
    // bitmap first. That costs one extra 8-bit copy; plain 8-bit images, which is
    // every camera photo and screenshot, go to the encoder untouched.
    private static func jpegEncodable(_ image: CGImage) throws -> CGImage {
        let colorSpace = image.colorSpace
        let model = colorSpace?.model
        let isExtended = colorSpace.map(CGColorSpaceUsesExtendedRange) ?? false
        let isHDR = colorSpace.map(CGColorSpaceUsesITUR_2100TF) ?? false
        if image.bitsPerComponent == 8,
            image.pixelFormatInfo == .packed,
            !image.bitmapInfo.contains(.floatComponents),
            model == .rgb || model == .monochrome,
            !isExtended, !isHDR
        {
            return image
        }

        // An ordinary RGB space is kept, so Display P3 stays P3. Extended-range and
        // PQ/HLG spaces can't back an 8-bit bitmap: those clip to Display P3 when
        // wide gamut and sRGB otherwise, as do gray, CMYK and the rest.
        let target: CGColorSpace?
        if model == .rgb, !isExtended, !isHDR, let colorSpace {
            target = colorSpace
        } else if model == .rgb, colorSpace?.isWideGamutRGB ?? false {
            target = CGColorSpace(name: CGColorSpace.displayP3)
        } else {
            target = CGColorSpace(name: CGColorSpace.sRGB)
        }
        guard let target,
            let context = CGContext(
                data: nil, width: image.width, height: image.height, bitsPerComponent: 8,
                bytesPerRow: 0, space: target,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue),
            let pixels = context.data
        else {
            throw MediaUtilsError.imageProcessingFailed(
                "Failed to create an 8-bit bitmap for the JPEG")
        }
        let rect = CGRect(x: 0, y: 0, width: image.width, height: image.height)
        // The bitmap starts fully transparent. Some decoders (AVIF) hand back an
        // image whose pixels are only produced when drawn, and if that fails the
        // draw leaves the bitmap untouched: without this check that would go out
        // as a blank JPEG instead of an error. A fully transparent deep-format image
        // fails here by design; Send original drops it with a notice rather than
        // upload an original that can carry its location.
        context.draw(image, in: rect)
        let rowBytes = context.bytesPerRow
        let bytes = pixels.assumingMemoryBound(to: UInt8.self)
        var drewAnything = false
        rows: for y in 0..<image.height {
            let row = bytes + y * rowBytes
            for x in 0..<image.width where row[x * 4 + 3] != 0 {
                drewAnything = true
                break rows
            }
        }
        guard drewAnything else {
            throw MediaUtilsError.imageProcessingFailed("Failed to decode image")
        }
        // Flatten over white, as the encoder does for an 8-bit image with alpha.
        context.setBlendMode(.destinationOver)
        context.setFillColor(gray: 1, alpha: 1)
        context.fill(rect)
        guard let redrawn = context.makeImage() else {
            throw MediaUtilsError.imageProcessingFailed("Failed to redraw image for the JPEG")
        }
        return redrawn
    }

    // Whether any frame of the image carries GPS. A frame ImageIO can't read
    // properties for is assumed to: it reports none at all, not even a pixel
    // size, for a truncated JPEG whose header still holds the GPS.
    private static func hasLocation(_ url: URL) -> Bool {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return true }
        let count = CGImageSourceGetCount(source)
        guard count > 0 else { return true }
        let container = CGImageSourceCopyProperties(source, nil) as? [CFString: Any]
        if let gps = container?[kCGImagePropertyGPSDictionary] as? [CFString: Any], !gps.isEmpty {
            return true
        }
        return (0..<count).contains { index in
            guard let props = CGImageSourceCopyPropertiesAtIndex(source, index, nil) as? [CFString: Any],
                props[kCGImagePropertyPixelWidth] != nil
            else { return true }
            let gps = props[kCGImagePropertyGPSDictionary] as? [CFString: Any]
            return !(gps?.isEmpty ?? true)
        }
    }

    // Strips the image in place if it carries GPS. Returns whether it is free of
    // GPS afterwards: the strip skips formats ImageIO can't write, and can fail.
    private static func removeLocation(at url: URL) -> Bool {
        guard hasLocation(url) else { return true }
        do {
            try stripImageExif(at: url)
        } catch {
            log.warning(
                "stripImageExif failed for \(url.path, privacy: .private): \(error.localizedDescription, privacy: .private)"
            )
            return false
        }
        return !hasLocation(url)
    }

    private static func stripImageExif(at url: URL) throws {
        guard let cgSource = CGImageSourceCreateWithURL(url as CFURL, nil) else {
            throw MediaUtilsError.imageProcessingFailed("Failed to create image source")
        }

        // No type means ImageIO can't read it (empty or corrupt file).
        guard let type = CGImageSourceGetType(cgSource) else {
            throw MediaUtilsError.unrecognizedImageFormat
        }
        // ImageIO reads more formats than it writes (RAW, webp). Those can't be
        // rewritten in place, and the JPEG re-encode carries no metadata anyway.
        let writable = CGImageDestinationCopyTypeIdentifiers() as? [String] ?? []
        guard writable.contains(type as String) else {
            return
        }
        let count = CGImageSourceGetCount(cgSource)
        let tmpDstURL = url.appendingPathExtension("tmp")

        defer {
            // Cleanup temporary file
            try? FileManager.default.removeItem(at: tmpDstURL)
        }

        guard
            let cgDestination = CGImageDestinationCreateWithURL(
                tmpDstURL as CFURL, type, count, nil)
        else {
            throw MediaUtilsError.imageProcessingFailed("Failed to create image destination")
        }

        let removeExifProperties =
            [
                kCGImagePropertyExifDictionary: kCFNull,
                kCGImagePropertyGPSDictionary: kCFNull,
            ] as CFDictionary

        // The container's own properties (an animation's loop count) aren't
        // copied with the frames; without them an APNG plays forever.
        if var container = CGImageSourceCopyProperties(cgSource, nil) as? [CFString: Any] {
            container[kCGImagePropertyExifDictionary] = nil
            container[kCGImagePropertyGPSDictionary] = nil
            CGImageDestinationSetProperties(cgDestination, container as CFDictionary)
        }

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

// The only export the app ever runs: "keep full size" never re-encodes, so
// reaching the exporter at all means compressing or applying a trim. Changing
// the preset here changes it for both the share extension and in-chat attach.
struct VideoExportSettings {
    let preset: String
    // Video + audio combined, in bits per second. nil leaves the preset's own
    // bitrate alone.
    let totalBitrate: Int?

    // 720p at ~3.9 Mbps reproduces what the old picker-driven flow produced:
    // a 28s 1080p/60 clip lands around 13 MB either way.
    static let compressed = VideoExportSettings(
        preset: AVAssetExportPreset1280x720, totalBitrate: 3_900_000)
}
