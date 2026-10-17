import Foundation
import UniformTypeIdentifiers

// The name a shared file is saved under, which is the name recipients see.
// Each item already gets its own directory, so the name only has to be
// readable, not unique.
enum PayloadFileName {
  // APFS allows 255 UTF-8 bytes per name; leave room for the suffixes the app
  // adds to its copies (".processed.mp4", ".compressed.jpg", ".converted.jpg",
  // and ".tmp" while it strips a location in place).
  static let maxNameBytes = 200
  // A longer "extension" is really part of the name.
  private static let maxExtBytes = 16

  // Uses the first usable candidate (a provider's suggestedName, a file's or a
  // download's last path component), else fallbackBase. The name keeps an extension that
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

  // The name long shared text is attached under: its first words, so the
  // attachment reads as what it is rather than a random name.
  static func forText(_ text: String) -> String {
    // Bounded: splitting the whole of a multi-megabyte text would build an
    // array of every word in the extension's small memory budget.
    let words = text.split(maxSplits: maxTextNameWords, omittingEmptySubsequences: true, whereSeparator: { $0.isWhitespace })
      .prefix(maxTextNameWords)
    var snippet = ""
    for word in words {
      // Only as much of a word as could fit: a text with no whitespace is one
      // word, and copying all of it would double the text in memory.
      let word = word.prefix(maxTextNameChars + 1)
      let next = snippet.isEmpty ? String(word) : "\(snippet) \(word)"
      if next.count > maxTextNameChars { break }
      snippet = next
    }
    if snippet.isEmpty, let first = words.first {
      snippet = String(first.prefix(maxTextNameChars))
    }
    // "word..txt" reads as a typo.
    while snippet.hasSuffix(".") {
      snippet.removeLast()
    }
    // Named with .txt already, so a dot in the words ("see example.com") is
    // never taken for the extension.
    return make(
      candidates: snippet.isEmpty ? [] : ["\(snippet).txt"], type: .plainText, fallbackBase: "shared-text")
  }
  private static let maxTextNameChars = 40
  private static let maxTextNameWords = 6

  // The name a downloaded video is saved under. The served MIME type wins, then
  // the URL's extension; with neither registered the name keeps whatever
  // extension the URL has, and mp4 is only a guess for a URL with none.
  static func downloadedVideo(from url: URL, mime: String) -> String {
    let ext = url.pathExtension.lowercased()
    let type = declared(UTType(mimeType: mime)) ?? declared(UTType(filenameExtension: ext))
    return make(
      candidates: [url.lastPathComponent], type: type ?? (ext.isEmpty ? .mpeg4Movie : nil),
      fallbackBase: "video")
  }

  // An unregistered MIME type or extension yields a dynamic UTType, not nil,
  // and a dynamic type has no extension to name the file with.
  private static func declared(_ type: UTType?) -> UTType? {
    guard let type = type, !type.isDynamic, type.preferredFilenameExtension != nil else {
      return nil
    }
    return type
  }

  // A path separator would escape the item's directory (a backslash is one on
  // Windows, where a recipient saves it), a leading dot would hide the file,
  // control characters (newlines) garble it in the UI, and format characters
  // (bidi overrides and isolates, marks) can make it read as another name.
  // .controlCharacters isn't used: it holds the format characters below that
  // must stay.
  private static let replaced = CharacterSet(charactersIn: "/\\:")
    .union(.newlines)
    .union(CharacterSet(charactersIn: Unicode.Scalar(0x00)!...Unicode.Scalar(0x1F)!))
    .union(CharacterSet(charactersIn: Unicode.Scalar(0x7F)!...Unicode.Scalar(0x9F)!))

  // Format characters that only shape text and can't reorder it: the joiners
  // (emoji sequences, Persian) and the tag characters of subdivision flags.
  private static func isKeptFormat(_ scalar: Unicode.Scalar) -> Bool {
    return scalar.value == 0x200C || scalar.value == 0x200D || (0xE0020...0xE007F).contains(scalar.value)
  }

  private static func isReplaced(_ scalar: Unicode.Scalar) -> Bool {
    if replaced.contains(scalar) { return true }
    return scalar.properties.generalCategory == .format && !isKeptFormat(scalar)
  }

  private static func sanitize(_ candidate: String?) -> String? {
    guard let candidate = candidate else { return nil }
    let trimmed = candidate.trimmingCharacters(
      in: .whitespacesAndNewlines.union(CharacterSet(charactersIn: "/.")))
    let cleaned = String(
      String.UnicodeScalarView(trimmed.unicodeScalars.map { isReplaced($0) ? "_" : $0 }))
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
