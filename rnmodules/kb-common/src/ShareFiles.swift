import Foundation
import ImageIO
import UniformTypeIdentifiers
import os

private let log = Logger(subsystem: "com.keybase.app", category: "item-provider")

// The file work behind a share's payloads and manifest. No UIKit, so it can be
// exercised off-device.
enum ShareFiles {
  // The app reads the manifest as soon as it is opened, so it must never see a
  // partial one: the JSON is written to a temporary file in the same directory
  // and renamed over the old manifest in one step. If that fails the old
  // manifest is removed too, since it belongs to an earlier share. Returns
  // the bytes written, or nil if the new manifest isn't in place.
  static func writeManifest(_ items: [[String: Any]], to url: URL) -> Data? {
    do {
      guard JSONSerialization.isValidJSONObject(items) else {
        throw CocoaError(.propertyListWriteInvalid)
      }
      let data = try JSONSerialization.data(withJSONObject: items, options: [])
      try data.write(to: url, options: .atomic)
      return data
    } catch {
      log.error("manifest write failed: \(String(describing: error), privacy: .private)")
      removeManifest(at: url)
      return nil
    }
  }

  // Removes the manifest only if it still holds contents, so a manifest the
  // other process (app or extension) wrote since is left alone.
  static func removeManifest(at url: URL, ifContents contents: Data) {
    guard (try? Data(contentsOf: url)) == contents else { return }
    removeManifest(at: url)
  }

  static func removeManifest(at url: URL) {
    do {
      try FileManager.default.removeItem(at: url)
    } catch CocoaError.fileNoSuchFile {
    } catch {
      log.error("manifest remove failed: \(String(describing: error), privacy: .private)")
    }
  }

  // Puts src at dst. A provider's temporary file is ours until its completion
  // handler returns, so it is moved, which costs nothing on the same volume
  // where a copy would double the disk used by a large video. A move that fails
  // (another volume, a source we can't remove) falls back to a copy.
  static func place(_ src: URL, at dst: URL, move: Bool) throws {
    let fm = FileManager.default
    if move {
      do {
        try fm.moveItem(at: src, to: dst)
        return
      } catch {
        log.info("payload move failed, copying: \(String(describing: error), privacy: .private)")
        // dst is in a fresh per-item directory, so anything there is a
        // leftover of the failed move.
        try? fm.removeItem(at: dst)
      }
    }
    try fm.copyItem(at: src, to: dst)
  }

  // The image format of data, from its header alone, so it costs nothing next
  // to a decode. nil unless ImageIO knows the format and finds an image in it.
  static func imageType(of data: Data) -> UTType? {
    guard let source = CGImageSourceCreateWithData(data as CFData, nil),
      let id = CGImageSourceGetType(source),
      CGImageSourceGetCount(source) > 0
    else { return nil }
    return UTType(id as String)
  }
}
