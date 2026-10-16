import Foundation
import UniformTypeIdentifiers

// The name a shared file is saved under, which is the name recipients see.
// Each item already gets its own directory, so the name only has to be
// readable, not unique.
enum PayloadFileName {
  // APFS allows 255 UTF-8 bytes per name; leave room for the suffixes the app
  // adds to its copies (".processed.mp4", ".compressed.jpg", ".converted.jpg",
  // and ".tmp" while it strips GPS in place).
  static let maxNameBytes = 200
  // A longer "extension" is really part of the name.
  private static let maxExtBytes = 16

  // Uses the first usable candidate (a provider's suggestedName, a file's last
  // path component), else fallbackBase. The name keeps an extension that
  // matches type and gets type's preferred one otherwise, so the app can tell
  // what the file is.
  static func make(candidates: [String?], type: UTType?, fallbackBase: String) -> String {
    // UTType prefers "jpeg"; "jpg" is what people and the app's own
    // transcodes use.
    let ext = type?.conforms(to: .jpeg) == true ? "jpg" : type?.preferredFilenameExtension
    for candidate in candidates {
      guard let name = sanitize(candidate) else { continue }
      return withExtension(name, ext: ext, type: type)
    }
    return ext.map { "\(fallbackBase).\($0)" } ?? fallbackBase
  }

  // A path separator would escape the item's directory, a leading dot would
  // hide the file, and control characters (newlines) garble it in the UI.
  // Only C0/C1 controls and line breaks: .controlCharacters also holds format
  // characters such as the zero-width joiner inside emoji sequences.
  private static let replaced = CharacterSet(charactersIn: "/:")
    .union(.newlines)
    .union(CharacterSet(charactersIn: Unicode.Scalar(0x00)!...Unicode.Scalar(0x1F)!))
    .union(CharacterSet(charactersIn: Unicode.Scalar(0x7F)!...Unicode.Scalar(0x9F)!))

  private static func sanitize(_ candidate: String?) -> String? {
    guard let candidate = candidate else { return nil }
    let trimmed = candidate.trimmingCharacters(
      in: .whitespacesAndNewlines.union(CharacterSet(charactersIn: "/.")))
    let cleaned = String(
      String.UnicodeScalarView(trimmed.unicodeScalars.map { replaced.contains($0) ? "_" : $0 }))
    return cleaned.isEmpty ? nil : cleaned
  }

  private static func withExtension(_ name: String, ext: String?, type: UTType?) -> String {
    var current = (name as NSString).pathExtension
    if current.utf8.count > maxExtBytes {
      current = ""
    }
    var base = name
    var keptExt: String? = current.isEmpty ? nil : current
    if let ext = ext, let type = type {
      let currentType = current.isEmpty ? nil : UTType(filenameExtension: current.lowercased())
      if currentType?.conforms(to: type) != true {
        keptExt = ext
      }
      // A known extension that doesn't match is replaced (photo.png sent as a
      // JPEG is photo.jpg); anything else is part of the name (My.Photo).
      if currentType?.isDeclared == true {
        base = (name as NSString).deletingPathExtension
      }
    } else if keptExt != nil {
      base = (name as NSString).deletingPathExtension
    }
    // Cut whole Characters so a multi-byte one is never split.
    let extBytes = keptExt.map { $0.utf8.count + 1 } ?? 0
    while base.utf8.count + extBytes > maxNameBytes {
      base.removeLast()
    }
    if base.isEmpty {
      base = "file"
    }
    return keptExt.map { "\(base).\($0)" } ?? base
  }
}
