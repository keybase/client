import Foundation
import AVFoundation
import UIKit
import ImageIO

typealias ProcessMediaCompletion = (Error?, URL?) -> Void
typealias ProcessMediaCompletionErrorOnly = (Error?) -> Void

@objc(MediaUtils)
class MediaUtils: NSObject {
    
    private static var scaledImageOptions: CFDictionary {
        return [
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceThumbnailMaxPixelSize: 1200
        ] as CFDictionary
    }
    
    private static func scaleDownCGImageSource(_ img: CGImageSource, dstURL: URL, options: CFDictionary) -> Error? {
        print("dstURL: \(dstURL)")
        let error = NSError(domain: "MediaUtils", code: 1, userInfo: [NSLocalizedDescriptionKey: "error writing scaled down image"])
        
        guard let scaledRef = CGImageSourceCreateThumbnailAtIndex(img, 0, options) else {
            return error
        }
        
        guard let scaled = UIImage(cgImage: scaledRef).jpegData(compressionQuality: 0.85) else {
            return error
        }
        
        do {
            try scaled.write(to: dstURL)
            return nil
        } catch {
            return error
        }
    }
    
    private static func stripImageExif(at url: URL) -> Error? {
        guard let cgSource = CGImageSourceCreateWithURL(url as CFURL, nil) else {
            return NSError(domain: "MediaUtils", code: 1, userInfo: ["message": "Failed to create image source"])
        }
        
        let type = CGImageSourceGetType(cgSource)
        let count = CGImageSourceGetCount(cgSource)
        let tmpDstURL = url.appendingPathExtension("tmp")
        
        guard let cgDestination = CGImageDestinationCreateWithURL(tmpDstURL as CFURL, type!, count, nil) else {
            return NSError(domain: "MediaUtils", code: 1, userInfo: ["message": "Failed to create image destination"])
        }
        
        let removeExifProperties = [
            kCGImagePropertyExifDictionary: kCFNull,
            kCGImagePropertyGPSDictionary: kCFNull
        ] as CFDictionary
        
        for index in 0..<count {
            CGImageDestinationAddImageFromSource(cgDestination, cgSource, index, removeExifProperties)
        }
        
        guard CGImageDestinationFinalize(cgDestination) else {
            return NSError(domain: "MediaUtils", code: 1, userInfo: ["message": "CGImageDestinationFinalize failed"])
        }
        
        do {
            try FileManager.default.replaceItem(at: url, withItemAt: tmpDstURL,  backupItemName: nil,
                                                options: [],
                                                resultingItemURL: nil)
            return nil
        } catch {
            return error
        }
    }
    
    @objc static func processImage(fromOriginal url: URL, completion: @escaping ProcessMediaCompletion) {
        if let error = stripImageExif(at: url) {
            completion(error, nil)
            return
        }
        
        let basename = url.deletingPathExtension().lastPathComponent
        let parent = url.deletingLastPathComponent()
        let scaledURL = parent.appendingPathComponent("\(basename).scaled.jpg")
        
        guard let cgSource = CGImageSourceCreateWithURL(url as CFURL, nil) else {
            completion(NSError(domain: "MediaUtils", code: 1, userInfo: nil), nil)
            return
        }
        
        if let error = scaleDownCGImageSource(cgSource, dstURL: scaledURL, options: scaledImageOptions) {
            completion(error, nil)
        } else {
            completion(nil, scaledURL)
        }
    }
    
    private static func needScaleDownAsset(_ asset: AVURLAsset) -> Bool {
        for track in asset.tracks {
            let size = track.naturalSize
            if size.height * size.width > 640 * 480 {
                return true
            }
        }
        return false
    }
    
    private static func stripVideoExifAndComplete(asset: AVURLAsset, originalURL: URL, completion: @escaping ProcessMediaCompletionErrorOnly) {
        let tmpDstURL = originalURL.appendingPathExtension("tmp")
        guard let exportSession = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetMediumQuality) else {
            completion(NSError(domain: "MediaUtils", code: 1, userInfo: nil))
            return
        }
        
        exportSession.shouldOptimizeForNetworkUse = true
        exportSession.outputFileType = .mp4
        exportSession.outputURL = tmpDstURL
        
        exportSession.exportAsynchronously {
            if let error = exportSession.error {
                completion(error)
                return
            }
            
            do {
                try FileManager.default.replaceItem(at: originalURL, withItemAt: tmpDstURL,  backupItemName: nil,
                                                    options: [],
                                                    resultingItemURL: nil)
                completion(nil)
            } catch {
                completion(error)
            }
        }
    }
    
    @objc static func processVideo(fromOriginal url: URL, completion: @escaping ProcessMediaCompletion) {
        let basename = url.deletingPathExtension().lastPathComponent
        let parent = url.deletingLastPathComponent()
        let normalVideoURL = parent.appendingPathComponent("\(basename).scaled.mp4")
        
        let asset = AVURLAsset(url: url)
        let generateImg = AVAssetImageGenerator(asset: asset)
        generateImg.appliesPreferredTrackTransform = true
        
        do {
            _ = try generateImg.copyCGImage(at: CMTimeMake(value: 1, timescale: 1), actualTime: nil)
        } catch {
            completion(error, nil)
            return
        }
        
        if !needScaleDownAsset(asset) {
            stripVideoExifAndComplete(asset: asset, originalURL: url) { error in
                if let error = error {
                    completion(error, nil)
                } else {
                    completion(nil, url)
                }
            }
            return
        }
        
        guard let exportSession = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetMediumQuality) else {
            completion(NSError(domain: "MediaUtils", code: 1, userInfo: nil), nil)
            return
        }
        
        exportSession.shouldOptimizeForNetworkUse = true
        exportSession.outputFileType = .mp4
        exportSession.outputURL = normalVideoURL
        
        exportSession.exportAsynchronously {
            if let error = exportSession.error {
                completion(error, nil)
                return
            }
            
            stripVideoExifAndComplete(asset: asset, originalURL: url) { error in
                if let error = error {
                    completion(error, nil)
                } else {
                    completion(nil, normalVideoURL)
                }
            }
        }
    }
}
