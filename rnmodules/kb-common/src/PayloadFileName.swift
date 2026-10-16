import Foundation
import UniformTypeIdentifiers

// The name a shared file is saved under, which is the name recipients see.
// Each item already gets its own directory, so the name only has to be
// readable, not unique.
enum PayloadFileName {
  static let maxBaseLength = 100

  // Uses the first usable candidate (a provider's suggestedName, a download's
  // last path component), else fallbackBase. The name keeps an extension that
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

  // A path separator would escape the item's directory, and a leading dot
  // would hide the file.
  private static func sanitize(_ candidate: String?) -> String? {
    guard let candidate = candidate else { return nil }
    let trimmed = candidate.trimmingCharacters(
      in: .whitespacesAndNewlines.union(CharacterSet(charactersIn: "/.")))
    let cleaned = trimmed.components(separatedBy: CharacterSet(charactersIn: "/:\0")).joined(
      separator: "_")
    return cleaned.isEmpty ? nil : cleaned
  }

  private static func withExtension(_ name: String, ext: String?, type: UTType?) -> String {
    let current = (name as NSString).pathExtension
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
    if base.count > maxBaseLength {
      base = String(base.prefix(maxBaseLength))
    }
    if base.isEmpty {
      base = "file"
    }
    return keptExt.map { "\(base).\($0)" } ?? base
  }
}
