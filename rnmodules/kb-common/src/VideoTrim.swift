import AVFoundation
import UIKit

// UIVideoEditorController always re-encodes; there is no passthrough trim.
// So a cut costs one encode no matter what. To keep "don't compress" honest
// for untouched clips, we compare durations afterwards and throw away the
// editor's output when the user did not actually move the handles.
@objc(VideoTrim)
public class VideoTrim: NSObject, UIVideoEditorControllerDelegate, UINavigationControllerDelegate {
    private static let durationEpsilon: Double = 0.05

    private var completion: ((String?, Error?) -> Void)?
    private var sourceDuration: Double = 0
    private static var inFlight: VideoTrim?

    // The presenter comes from the caller: KBCommon is also linked into the share
    // extension, where UIApplication.shared is unavailable, so this file cannot
    // look the view controller up itself.
    @objc public static func present(
        path: String,
        from presenter: UIViewController,
        highQuality: Bool,
        completion: @escaping (String?, Error?) -> Void
    ) {
        DispatchQueue.main.async {
            // Only one editor at a time: inFlight is the helper's only strong
            // reference, so a second present() would strand the first.
            guard Self.inFlight == nil else {
                completion(nil, MediaUtilsError.invalidInput("A video editor is already open"))
                return
            }
            guard UIVideoEditorController.canEditVideo(atPath: path) else {
                completion(nil, MediaUtilsError.invalidInput("Video cannot be edited: \(path)"))
                return
            }
            var root = presenter
            while let presented = root.presentedViewController {
                root = presented
            }

            let helper = VideoTrim()
            helper.completion = completion
            helper.sourceDuration = CMTimeGetSeconds(AVURLAsset(url: URL(fileURLWithPath: path)).duration)
            // Retained for the lifetime of the modal: UIVideoEditorController
            // holds its delegate weakly.
            Self.inFlight = helper

            let editor = UIVideoEditorController()
            editor.videoPath = path
            editor.videoQuality = highQuality ? .typeHigh : .typeMedium
            editor.delegate = helper
            // Its chrome assumes full screen; the iOS 13+ pageSheet default
            // crushes the title bar and the trim filmstrip together.
            editor.modalPresentationStyle = .fullScreen
            root.present(editor, animated: true)
        }
    }

    private func finish(_ editor: UIVideoEditorController, path: String?, error: Error?) {
        let done = completion
        completion = nil
        editor.dismiss(animated: true) {
            VideoTrim.inFlight = nil
            done?(path, error)
        }
    }

    public func videoEditorController(_ editor: UIVideoEditorController, didSaveEditedVideoToPath editedVideoPath: String) {
        let editedDuration = CMTimeGetSeconds(AVURLAsset(url: URL(fileURLWithPath: editedVideoPath)).duration)
        let unchanged = abs(editedDuration - sourceDuration) < VideoTrim.durationEpsilon
        if unchanged {
            try? FileManager.default.removeItem(atPath: editedVideoPath)
        }
        finish(editor, path: unchanged ? nil : editedVideoPath, error: nil)
    }

    public func videoEditorController(_ editor: UIVideoEditorController, didFailWithError error: Error) {
        finish(editor, path: nil, error: error)
    }

    public func videoEditorControllerDidCancel(_ editor: UIVideoEditorController) {
        finish(editor, path: nil, error: nil)
    }
}
