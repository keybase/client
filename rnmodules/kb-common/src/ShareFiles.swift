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

// What a shared attachment is loaded as, best first: providers register
// several representations for one item in no particular order (a provider can
// list public.url ahead of the image itself), so media beats a link, and any
// type we know nothing about comes last.
enum ShareItemKind: Int {
  case movie = 0
  case imageFile = 1
  case image = 2
  case vCard = 3
  case file = 4
  case text = 5
  case url = 6
  // Anything else, loaded as a file under its own name, so nothing a host
  // offers is skipped.
  case data = 7

  // Text that is pasted into the composer. Other types that conform to plain
  // text (csv, markdown, source code) are documents with names and go as files.
  private static let pastedText: [UTType] = [.plainText, .utf8PlainText, .utf16PlainText, .utf16ExternalPlainText]

  static func of(type stype: String) -> ShareItemKind {
    guard let type = UTType(stype) else { return .data }
    if type.conforms(to: .movie) { return .movie }
    if type.conforms(to: .png) || type.conforms(to: .gif) || type.conforms(to: .jpeg)
      || stype == "public.heic"
    {
      return .imageFile
    }
    if type.conforms(to: .image) { return .image }
    if type.conforms(to: .vCard) { return .vCard }
    if type.conforms(to: .pdf) || type.conforms(to: .fileURL) { return .file }
    if pastedText.contains(type) { return .text }
    if type.conforms(to: .url) { return .url }
    return .data
  }

  // The type to load an attachment as; nil only when it offers none. Among
  // types of one kind the provider's first, its highest fidelity, wins.
  static func best(of types: [String]) -> (stype: String, kind: ShareItemKind)? {
    var best: (stype: String, kind: ShareItemKind)?
    for stype in types {
      let kind = of(type: stype)
      if best == nil || kind.rawValue < best!.kind.rawValue {
        best = (stype, kind)
      }
    }
    return best
  }

  // Whether an attachment is the host's own object for something the share's
  // text or links already say, like the private map item Maps attaches beside
  // a place's link and name. Such an object isn't a file and can't be loaded
  // as one, so it is left out. A document type, or a dynamic type (which only
  // a file's extension or MIME type yields), is a real file and always kept.
  static func isHostObject(_ stype: String, besideTextOrLink: Bool) -> Bool {
    guard besideTextOrLink, of(type: stype) == .data else { return false }
    guard let type = UTType(stype) else { return true }
    return !type.isDynamic && !type.conforms(to: .content)
  }

  // Whether any of a share's attachments, each given by the types it offers,
  // is loaded as text or a link.
  static func carriesTextOrLink(_ attachments: [[String]]) -> Bool {
    return attachments.contains {
      guard let kind = best(of: $0)?.kind else { return false }
      return kind == .text || kind == .url
    }
  }

  // For the log: system types as they are, anything an app declared (which
  // can name the app) redacted, and dynamic types too, which encode the file
  // extension or MIME type they stand for.
  static func publicDescription(of types: [String]) -> String {
    let shown = types.map {
      $0.hasPrefix("dyn.")
        ? "<dynamic type>" : $0.hasPrefix("public.") || $0.hasPrefix("com.apple.") ? $0 : "<app type>"
    }
    return "[" + shown.joined(separator: ", ") + "]"
  }
}

// The text a share carries: the host's caption plus every text and link item.
enum ShareText {
  // Chat's limit on a text message, in bytes (TextMessageMaxLength in
  // go/chat/msgchecker). Longer text is attached as a .txt file instead.
  static let maxInlineBytes = 10000

  static func fitsInline(_ text: String) -> Bool {
    return text.utf8.count <= maxInlineBytes
  }

  static func isBlank(_ text: String) -> Bool {
    return text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
  }

  enum Piece: Equatable {
    // a text or link the host shared
    case item(String)
    // the host's text for an extension item: Safari's page title, for one
    case caption(String)
  }

  // The message a share's text comes to. A host's caption is kept only as
  // the title of a shared link: Safari also captions a selection and an image
  // page with the page's title, which there is only noise.
  static func message(from pieces: [Piece], withMedia: Bool) -> String? {
    let items = pieces.compactMap { piece -> String? in
      if case let .item(text) = piece { return text }
      return nil
    }
    let titlesLinks = !withMedia && !items.isEmpty && items.allSatisfy(isLink)
    return join(pieces.compactMap {
      switch $0 {
      case let .item(text): return text
      case let .caption(text): return titlesLinks ? text : nil
      }
    })
  }

  // The URL a link item's text names, if it is one. URL(string:) no longer
  // fails on plain text (it percent-encodes "hello world"), so a URL without a
  // scheme is text, not a link.
  static func linkURL(_ text: String) -> URL? {
    guard let url = URL(string: text.trimmingCharacters(in: .whitespacesAndNewlines)),
      let scheme = url.scheme, !scheme.isEmpty
    else { return nil }
    return url
  }

  // A lone web address, nothing else.
  static func isLink(_ text: String) -> Bool {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.contains(where: { $0.isWhitespace }), let url = URL(string: trimmed),
      let scheme = url.scheme?.lowercased()
    else { return false }
    return (scheme == "http" || scheme == "https") && url.host != nil
  }

  // Joins the pieces in share order, one per line. A piece already inside
  // another (a page's link that its caption also carries, a Maps link inside
  // the place's card, the same text twice) is left out.
  private static func join(_ pieces: [String]) -> String? {
    let trimmed = pieces.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    var kept: [String] = []
    for (i, p) in trimmed.enumerated() {
      let covered = trimmed.enumerated().contains { j, q in
        (q.count > p.count || (q == p && j < i)) && contains(q, whole: p)
      }
      if !covered {
        kept.append(p)
      }
    }
    return kept.isEmpty ? nil : kept.joined(separator: "\n")
  }

  private static let before = CharacterSet.whitespacesAndNewlines.union(CharacterSet(charactersIn: "(<\"'"))
  private static let after = CharacterSet.whitespacesAndNewlines.union(CharacterSet(charactersIn: ".,;:!?)>\"'"))

  // Whether needle appears in haystack on its own, not as part of a longer
  // word or link (https://a.co is not inside https://a.com).
  private static func contains(_ haystack: String, whole needle: String) -> Bool {
    var from = haystack.startIndex
    while let r = haystack.range(of: needle, range: from..<haystack.endIndex) {
      let okBefore = r.lowerBound == haystack.startIndex
        || haystack[haystack.index(before: r.lowerBound)].unicodeScalars.allSatisfy { before.contains($0) }
      let okAfter = r.upperBound == haystack.endIndex
        || haystack[r.upperBound].unicodeScalars.allSatisfy { after.contains($0) }
      if okBefore && okAfter {
        return true
      }
      from = haystack.index(after: r.lowerBound)
    }
    return false
  }
}

// Which of a share's extension items hold what was shared. Safari adds the
// page itself as an extra item (flagged supportsJavaScript, for extensions
// that run script on it) next to the item it shares, such as an image page's
// image; that copy of the page isn't something the user picked.
// Only an item with attachments counts as the content next to the page: one
// carrying just text would leave the share with nothing to send.
public enum ShareExtensionItems {
  public static func shared(pageFlags: [Bool], attachmentCounts: [Int]) -> [Int] {
    let all = Array(pageFlags.indices)
    guard pageFlags.count > 1 else { return all }
    let content = all.filter { !pageFlags[$0] && attachmentCounts[$0] > 0 }
    return content.isEmpty ? all : content
  }
}

// Shared media links are downloaded into the shared container for the app to
// upload. Above this the link is shared instead; a download is stopped as soon
// as the server announces, or sends, more than this.
enum ShareDownload {
  static let maxBytes: Int64 = 200 * 1024 * 1024

  // expected is -1 when the server didn't say.
  static func overCap(expected: Int64, received: Int64) -> Bool {
    return expected > maxBytes || received > maxBytes
  }
}
