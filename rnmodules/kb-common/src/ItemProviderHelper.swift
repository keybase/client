import Contacts
import Foundation
import ImageIO
import UIKit
import UniformTypeIdentifiers
import os

private let log = Logger(subsystem: "com.keybase.app", category: "item-provider")

@objc(ItemProviderHelper)
public class ItemProviderHelper: NSObject {
  private var itemArrs: [Any]
  private var payloadFolderURL: URL
  private var isShare: Bool
  private var done = false
  private var typeToArray: [String: [[String: Any]]] = [:]
  private var completionHandler: () -> Void
  private var unprocessed: Int = 0

  // Drives the extension's progress bar. Each item is worth 100 units: 90 for
  // the provider's load, which reports bytes for the big cases, and 10 for the
  // copy/encode we do once the load hands back a temp file.
  @objc public let progress = Progress(totalUnitCount: 0)
  // One entry per item, retired as items finish. Which entry we retire doesn't
  // matter — they all carry the same weight.
  private var pendingItemProgress: [Progress] = []

  private func reserveItemProgress(loaderReportsProgress: Bool) {
    let done = Progress(totalUnitCount: 1)
    pendingItemProgress.append(done)
    progress.totalUnitCount += 100
    progress.addChild(done, withPendingUnitCount: loaderReportsProgress ? 10 : 100)
  }

  private func attachLoaderProgress(_ loader: Progress) {
    progress.addChild(loader, withPendingUnitCount: 90)
  }

  // The Safari-image path downloads after the item load already reported done,
  // so give it its own slice of the bar instead of leaving it invisible. Resume
  // from inside the main-queue hop: starting the task first lets a fast download
  // finish before its units are added, which walks the bar backwards.
  private func startTracked(_ task: URLSessionTask) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      self.progress.totalUnitCount += 100
      self.progress.addChild(task.progress, withPendingUnitCount: 100)
      task.resume()
    }
  }

  // What the share sends, plus one "error" entry per item that failed so the
  // app can say how many didn't make it.
  @objc public var manifest: [[String: Any]] {
    return preparedItems + (typeToArray["error"] ?? [])
  }

  // Items startProcessing recognised and set out to load: not every attachment
  // a share carries is one. Main thread only.
  @objc public private(set) var itemCount = 0

  // Items that failed to load or copy. Main thread only.
  @objc public var failedCount: Int {
    return typeToArray["error"]?.count ?? 0
  }

  // Whether anything finished that the share can send. Main thread only.
  @objc public var hasPreparedItems: Bool {
    return !preparedItems.isEmpty
  }

  // What the last manifest write put on disk; nil if it failed.
  private var writtenManifest: Data?

  // Whether the last manifest write landed. When it didn't, whatever is on
  // disk isn't this share's manifest and the app must not be opened to it.
  // Main thread only.
  @objc public var manifestWritten: Bool {
    return writtenManifest != nil
  }

  // Whether any manifest is on disk, ours or not.
  @objc public var manifestExists: Bool {
    return FileManager.default.fileExists(atPath: getManifestFileURL().path)
  }

  private var preparedItems: [[String: Any]] {
    // reconcile what we're sending over. types=text, url, video, image, file
    var toWrite: [[String: Any]] = []
    let images = typeToArray["image"] ?? []
    let videos = typeToArray["video"] ?? []
    let files = typeToArray["file"] ?? []

    // Media wins over everything else: we want to attach the thing, not also
    // inject into the input box. A share can carry a url attachment next to the
    // media one, and the media is what was asked for.
    if !images.isEmpty || !videos.isEmpty || !files.isEmpty {
      toWrite.append(contentsOf: images)
      toWrite.append(contentsOf: videos)
      toWrite.append(contentsOf: files)
      return toWrite
    }

    // We treat all text that has http in it a url, we take the longest one as its
    // likely most descriptive
    if let urls = typeToArray["url"] {
      var content = urls.first?["content"] as? String ?? ""
      for url in urls {
        if let c = url["content"] as? String, c.count > content.count {
          content = c
        }
      }
      toWrite.append([
        "type": "text",
        "content": content,
      ])
    } else if let texts = typeToArray["text"], !texts.isEmpty {
      // Likely just one piece of text
      toWrite.append(texts[0])
    }

    return toWrite
  }

  @objc public init(
    forShare isShare: Bool, withItems itemArrs: [Any], completionHandler: @escaping () -> Void
  ) {
    self.isShare = isShare
    self.itemArrs = itemArrs
    self.completionHandler = completionHandler
    self.payloadFolderURL = Self.makePayloadFolder()
  }

  private func completeProcessingItemAlreadyInMainThread() {
    pendingItemProgress.popLast()?.completedUnitCount = 1
    finishOneAlreadyInMainThread()
  }

  // The bookkeeping half, for the balancing increment that stands in for the
  // whole batch rather than for an item: that one reserved no progress entry, so
  // retiring one here would mark an item still loading as done.
  private func finishOneAlreadyInMainThread() {
    // more to process
    objc_sync_enter(self)
    unprocessed -= 1
    if unprocessed > 0 {
      objc_sync_exit(self)
      return
    }
    objc_sync_exit(self)

    // done
    if !done {
      done = true
      writeManifest()
      completionHandler()
    } else {
      // already done?
    }
  }

  // Stops waiting on loads still in flight and writes the manifest from the
  // items that finished (empty if none, so an older share's manifest can't be
  // picked up). Returns whether there is anything to share. Main thread only.
  @objc public func finishEarly() -> Bool {
    guard !done else { return false }
    done = true
    progress.cancel()
    writeManifest()
    return hasPreparedItems && manifestWritten
  }

  // Abandons the share: in-flight loads are cancelled and an empty manifest
  // replaces any older one. Main thread only.
  @objc public func cancel() {
    guard !done else { return }
    done = true
    progress.cancel()
    typeToArray = [:]
    writeManifest()
  }

  private static func getIncomingShareFolder() -> URL {
    let containerURL = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: "group.keybase")!
    // Use the cache URL so if we fail to clean up payloads they can be deleted by
    // the OS.
    let cacheURL = containerURL.appendingPathComponent("Library", isDirectory: true)
      .appendingPathComponent("Caches", isDirectory: true)
    let incomingShareFolderURL = cacheURL.appendingPathComponent(
      "incoming-shares", isDirectory: true)
    return incomingShareFolderURL
  }

  private static func makePayloadFolder() -> URL {
    let incomingShareFolderURL = getIncomingShareFolder()
    let guid = ProcessInfo.processInfo.globallyUniqueString
    let payloadFolderURL = incomingShareFolderURL.appendingPathComponent(guid, isDirectory: true)
    try? FileManager.default.createDirectory(
      at: payloadFolderURL, withIntermediateDirectories: true, attributes: nil)
    return payloadFolderURL
  }

  // Each item gets its own subdirectory so same-named items (edited photos are all
  // FullSizeRender.jpg) don't collide while the real filename is kept.
  private func getPayloadURL(named name: String) throws -> URL {
    let guid = ProcessInfo.processInfo.globallyUniqueString
    let itemFolderURL = payloadFolderURL.appendingPathComponent(guid, isDirectory: true)
    try FileManager.default.createDirectory(
      at: itemFolderURL, withIntermediateDirectories: true, attributes: nil)
    return itemFolderURL.appendingPathComponent(name)
  }

  private func getPayloadURL(from url: URL) throws -> URL {
    return try getPayloadURL(
      named: PayloadFileName.make(
        candidates: [url.lastPathComponent], type: nil, fallbackBase: "file"))
  }

  private func getPayloadURL(withExtension ext: String?) -> URL {
    let guid = ProcessInfo.processInfo.globallyUniqueString
    return ext != nil
      ? payloadFolderURL.appendingPathComponent(guid).appendingPathExtension(ext!)
      : payloadFolderURL.appendingPathComponent(guid)
  }

  private func getManifestFileURL() -> URL {
    let incomingShareFolderURL = Self.getIncomingShareFolder()
    try? FileManager.default.createDirectory(
      at: incomingShareFolderURL, withIntermediateDirectories: true, attributes: nil)
    return incomingShareFolderURL.appendingPathComponent("manifest.json")
  }

  private func completeItemAndAppend(type: String, entry: [String: Any]) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      self.typeToArray[type, default: []].append(entry)
      self.completeProcessingItemAlreadyInMainThread()
    }
  }

  private func completeItemAndAppendManifest(type: String, originalFileURL: URL) {
    completeItemAndAppend(type: type, entry: [
      "type": type,
      "originalPath": originalFileURL.absoluteURL.path,
    ])
  }

  private func completeItemAndAppendManifest(type: String, content: String) {
    completeItemAndAppend(type: type, entry: [
      "type": type,
      "content": content,
    ])
  }

  private func completeItemAndAppendManifestAndLogError(text: String, error: Error?) {
    let reason = error != nil ? String(describing: error!) : "<empty>"
    // The error can carry file paths, so only the static text is public.
    log.error("item failed: \(text, privacy: .public): \(reason, privacy: .private)")
    // The service logs this, so it gets the static text only.
    completeItemAndAppend(type: "error", entry: ["type": "error", "error": text])
  }

  // Written even if empty so an older share's manifest can't be picked up.
  private func writeManifest() {
    writtenManifest = ShareFiles.writeManifest(manifest, to: getManifestFileURL())
  }

  // For a share that won't open the app: its manifest would only be read by
  // some later, unrelated open. A manifest written since by another share is
  // kept. Main thread only.
  @objc public func removeManifest() {
    guard let written = writtenManifest else { return }
    ShareFiles.removeManifest(at: getManifestFileURL(), ifContents: written)
  }

  private func sendText(_ text: String) {
    if text.isEmpty {
      completeItemAndAppendManifestAndLogError(text: "sendText: empty?", error: nil)
      return
    }

    if text.count < 1000 {
      let isURL = text.range(of: "http", options: .caseInsensitive) != nil
      completeItemAndAppendManifest(type: isURL ? "url" : "text", content: text)
      return
    }

    let originalFileURL = getPayloadURL(withExtension: "txt")
    do {
      try text.write(to: originalFileURL, atomically: true, encoding: .utf8)
      completeItemAndAppendManifest(type: "text", originalFileURL: originalFileURL)
    } catch {
      completeItemAndAppendManifestAndLogError(
        text: "sendText: unable to write payload file", error: error)
    }
  }

  // providerTemp: url is a load*Representation temp file, ours to move until
  // the completion handler returns. Must be called before it returns.
  private func sendFile(_ url: URL?, providerTemp: Bool) {
    guard let url = url else {
      completeItemAndAppendManifestAndLogError(text: "sendFile: unable to decode share", error: nil)
      return
    }

    do {
      let filePayloadURL = try getPayloadURL(from: url)
      try ShareFiles.place(url, at: filePayloadURL, move: providerTemp)
      completeItemAndAppendManifest(type: "file", originalFileURL: filePayloadURL)
    } catch {
      completeItemAndAppendManifestAndLogError(text: "fileHandlerSimple: copy error", error: error)
    }
  }

  private func sendContact(_ vCardData: Data) {
    do {
      let contacts = try CNContactVCardSerialization.contacts(with: vCardData)
      let addressFormatter = CNPostalAddressFormatter()
      var contents: [String] = []

      for contact in contacts {
        var content: [String] = []
        if let fullName = CNContactFormatter.string(from: contact, style: .fullName),
          !fullName.isEmpty
        {
          content.append(fullName)
        }

        // For NSString properties, we need to check length
        if (contact.organizationName as NSString).length > 0 {
          content.append("Organization: \(contact.organizationName)")
        }

        for phoneNumber in contact.phoneNumbers {
          let label = CNLabeledValue<NSString>.localizedString(forLabel: phoneNumber.label ?? "")
          let number = phoneNumber.value.stringValue

          if (label as NSString).length > 0 && (number as NSString).length > 0 {
            content.append("\(label): \(number)")
          } else if (number as NSString).length > 0 {
            content.append(number)
          }
        }

        // Handle email addresses and URLs
        var misc: [Any] = []
        misc.append(contentsOf: contact.emailAddresses)
        misc.append(contentsOf: contact.urlAddresses)

        for m in misc {
          if let labeledValue = m as? CNLabeledValue<NSString> {
            let label = CNLabeledValue<NSString>.localizedString(forLabel: labeledValue.label ?? "")
            let val = labeledValue.value as String

            if !label.isEmpty && !val.isEmpty {
              content.append("\(label): \(val)")
            } else if !val.isEmpty {
              content.append(val)
            }
          }
        }

        // Handle postal addresses
        for postalAddress in contact.postalAddresses {
          let label = CNLabeledValue<NSString>.localizedString(forLabel: postalAddress.label ?? "")
          let val = addressFormatter.string(from: postalAddress.value)

          if !label.isEmpty && !val.isEmpty {
            content.append("\(label): \(val)")
          } else if !val.isEmpty {
            content.append(val)
          }
        }

        if !content.isEmpty {
          contents.append(content.joined(separator: "\n"))
        }
      }

      if !contents.isEmpty {
        let text = contents.joined(separator: "\n\n")
        completeItemAndAppendManifest(type: "text", content: text)
      } else {
        completeItemAndAppendManifestAndLogError(
          text: "vcardHandler: unable to decode share", error: nil)
      }
    } catch {
      completeItemAndAppendManifestAndLogError(
        text: "vcardHandler: error processing vcard", error: error)
    }
  }

  // Bring the provider's file into our payload folder: a temp file is moved
  // (it's deleted when the completion handler returns), anything else copied.
  // The extension never transcodes: trimming and compression happen in the
  // app, which has no extension memory budget and can let the user edit before
  // encoding.
  private func sendMedia(_ url: URL?, isVideo: Bool, providerTemp: Bool) {
    guard let url = url else {
      completeItemAndAppendManifestAndLogError(text: "sendMedia: unable to decode share", error: nil)
      return
    }

    let filePayloadURL: URL
    do {
      filePayloadURL = try getPayloadURL(from: url)
      try ShareFiles.place(url, at: filePayloadURL, move: providerTemp)
    } catch {
      completeItemAndAppendManifestAndLogError(text: "sendMedia: copy error", error: error)
      return
    }
    completeItemAndAppendManifest(type: isVideo ? "video" : "image", originalFileURL: filePayloadURL)
  }

  // A public.url item is not necessarily a web link: providers also vend local
  // temp files this way. Route file URLs by their real content type instead of
  // pasting the path as text.
  private func sendURLItem(_ url: URL?) {
    guard let url = url else {
      completeItemAndAppendManifestAndLogError(text: "sendURLItem: unable to decode share", error: nil)
      return
    }
    guard url.isFileURL else {
      sendRemoteURL(url)
      return
    }

    let scoped = url.startAccessingSecurityScopedResource()
    defer { if scoped { url.stopAccessingSecurityScopedResource() } }

    let type = (try? url.resourceValues(forKeys: [.contentTypeKey]))?.contentType
      ?? UTType(filenameExtension: url.pathExtension)

    if let type = type {
      if type.conforms(to: .movie) {
        sendMedia(url, isVideo: true, providerTemp: false)
        return
      }
      if type.conforms(to: .image) {
        sendMedia(url, isVideo: false, providerTemp: false)
        return
      }
      // Only inline honest plain text. Plenty of document types (crash reports,
      // logs, source) conform to public.text but are files the user meant to
      // attach, extension and all.
      if !type.conforms(to: .plainText) {
        sendFile(url, providerTemp: false)
        return
      }
    }

    let text = (try? Data(contentsOf: url)).flatMap { String(data: $0, encoding: .utf8) }
    sendText(text ?? url.absoluteString)
  }

  // Safari's long-press-image share hands over the image's web address, not the
  // image, so the only way to attach the picture the user pointed at is to
  // fetch it. Probe with HEAD first so an ordinary link share doesn't download
  // a whole page before falling back to pasting the link.
  private static let probeTimeout: TimeInterval = 6
  private static let downloadTimeout: TimeInterval = 30

  private func sendRemoteURL(_ url: URL) {
    let sendLink: () -> Void = { [weak self] in self?.sendText(url.absoluteString) }

    if let type = UTType(filenameExtension: url.pathExtension.lowercased()),
      type.conforms(to: .image) || type.conforms(to: .movie)
    {
      downloadMedia(url, isVideo: type.conforms(to: .movie), sendLink: sendLink)
      return
    }

    var head = URLRequest(url: url, timeoutInterval: Self.probeTimeout)
    head.httpMethod = "HEAD"
    URLSession.shared.dataTask(with: head) { [weak self] _, response, _ in
      guard let self = self else { return }
      let mime = response?.mimeType ?? ""
      if mime.hasPrefix("image/") || mime.hasPrefix("video/") {
        self.downloadMedia(url, isVideo: mime.hasPrefix("video/"), sendLink: sendLink)
      } else {
        sendLink()
      }
    }.resume()
  }

  private func downloadMedia(_ url: URL, isVideo: Bool, sendLink: @escaping () -> Void) {
    let request = URLRequest(url: url, timeoutInterval: Self.downloadTimeout)
    let task = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
      guard let self = self else { return }
      let mime = response?.mimeType ?? ""
      guard error == nil, let data = data, !data.isEmpty,
        mime.isEmpty || mime.hasPrefix("image/") || mime.hasPrefix("video/")
      else {
        sendLink()
        return
      }
      // URLSession runs this on its delegate queue, and writing a shared video
      // out is enough file I/O to stall the extension's UI.
      DispatchQueue.global(qos: .userInitiated).async {
        self.writeDownloadedMedia(
          data, from: url, mime: mime, isVideo: isVideo || mime.hasPrefix("video/"),
          sendLink: sendLink)
      }
    }
    startTracked(task)
  }

  private func writeDownloadedMedia(
    _ data: Data, from url: URL, mime: String, isVideo: Bool, sendLink: @escaping () -> Void
  ) {
    if isVideo {
      let name = PayloadFileName.downloadedVideo(from: url, mime: mime)
      guard let payloadURL = try? getPayloadURL(named: name),
        (try? data.write(to: payloadURL, options: .atomic)) != nil
      else {
        sendLink()
        return
      }
      completeItemAndAppendManifest(type: "video", originalFileURL: payloadURL)
      return
    }

    // Written as served. Decoding a large image would blow the extension's
    // memory limit, so anything the app can't show as-is (webp, avif) is
    // transcoded there. The bytes, not the label, decide: a server can serve an
    // error page as image/*, and then the link is the better share.
    guard let imageType = ShareFiles.imageType(of: data),
      imageType.preferredFilenameExtension != nil
    else {
      sendLink()
      return
    }
    let name = PayloadFileName.make(
      candidates: [url.lastPathComponent], type: imageType, fallbackBase: "image")
    guard let payloadURL = try? getPayloadURL(named: name),
      (try? data.write(to: payloadURL, options: .atomic)) != nil
    else {
      sendLink()
      return
    }
    completeItemAndAppendManifest(type: "image", originalFileURL: payloadURL)
  }

  // A provider that vends the image as bytes rather than a file (Safari's
  // image pages). Written as-is, like a download.
  private func sendImageData(_ data: Data, typeIdentifier: String, suggestedName: String?) {
    guard let type = ShareFiles.imageType(of: data) ?? UTType(typeIdentifier),
      type.preferredFilenameExtension != nil
    else {
      completeItemAndAppendManifestAndLogError(
        text: "sendImageData: \(data.count) bytes of unknown image type \(typeIdentifier)",
        error: nil)
      return
    }
    let name = PayloadFileName.make(candidates: [suggestedName], type: type, fallbackBase: "image")
    do {
      let payloadURL = try getPayloadURL(named: name)
      try data.write(to: payloadURL, options: .atomic)
      completeItemAndAppendManifest(type: "image", originalFileURL: payloadURL)
    } catch {
      completeItemAndAppendManifestAndLogError(text: "sendImageData: write error", error: error)
    }
  }

  private enum ImageEncodeError: Error {
    case encodeFailed
  }

  private static func encodeJPEG(
    _ image: CGImage, orientation: CGImagePropertyOrientation, to url: URL
  ) throws {
    guard
      let dest = CGImageDestinationCreateWithURL(
        url as CFURL, UTType.jpeg.identifier as CFString, 1, nil)
    else {
      throw ImageEncodeError.encodeFailed
    }
    let props =
      [
        kCGImageDestinationLossyCompressionQuality: 0.85,
        kCGImagePropertyOrientation: orientation.rawValue,
      ] as CFDictionary
    CGImageDestinationAddImage(dest, image, props)
    guard CGImageDestinationFinalize(dest) else {
      throw ImageEncodeError.encodeFailed
    }
  }

  private static func cgOrientation(_ o: UIImage.Orientation) -> CGImagePropertyOrientation {
    switch o {
    case .up: return .up
    case .down: return .down
    case .left: return .left
    case .right: return .right
    case .upMirrored: return .upMirrored
    case .downMirrored: return .downMirrored
    case .leftMirrored: return .leftMirrored
    case .rightMirrored: return .rightMirrored
    @unknown default: return .up
    }
  }

  // A provider that vends only an in-memory UIImage has no file to copy. The
  // image is already decoded, so encoding it costs little extra memory.
  private func sendUIImage(_ image: UIImage, suggestedName: String?) {
    do {
      let payloadURL = try getPayloadURL(
        named: PayloadFileName.make(candidates: [suggestedName], type: .jpeg, fallbackBase: "image"))
      if let cgImage = image.cgImage {
        try Self.encodeJPEG(
          cgImage, orientation: Self.cgOrientation(image.imageOrientation), to: payloadURL)
      } else {
        // CIImage-backed: no CGImage to hand ImageIO.
        guard let jpeg = image.jpegData(compressionQuality: 0.85) else {
          throw ImageEncodeError.encodeFailed
        }
        try jpeg.write(to: payloadURL, options: .atomic)
      }
      completeItemAndAppendManifest(type: "image", originalFileURL: payloadURL)
    } catch {
      completeItemAndAppendManifestAndLogError(text: "sendUIImage: unable to encode share", error: error)
    }
  }

  // Every image goes through here. A file representation is the cheap path: the
  // provider's file is moved, never decoded. Two kinds of provider don't get
  // there. One vends only an in-memory UIImage. The other is Safari sharing an
  // image page, which vends the image as bytes: asking for a file makes
  // NSItemProvider write those bytes to a temp file and copy it, and that copy
  // intermittently fails with a nil error ("Failed to copy item ... to
  // temporary folder"). loadItem hands back the object itself either way.
  private func loadImage(_ item: NSItemProvider, typeIdentifier: String) -> Progress {
    return item.loadFileRepresentation(forTypeIdentifier: typeIdentifier) { url, error in
      if let url = url, error == nil {
        self.sendMedia(url, isVideo: false, providerTemp: true)
        return
      }
      // Cancel and the watchdog cancel the loads; don't start another.
      if (error as? CocoaError)?.code == .userCancelled {
        self.completeItemAndAppendManifestAndLogError(text: "loadImage: cancelled", error: error)
        return
      }
      log.info(
        "loadFileRepresentation(\(typeIdentifier, privacy: .public)) failed (\(String(describing: error), privacy: .private)); loading the item instead"
      )
      item.loadItem(forTypeIdentifier: typeIdentifier, options: nil) { loaded, error in
        switch loaded {
        // Some providers vend the image's web address as the image item.
        case let url as URL where error == nil && ["http", "https"].contains(url.scheme?.lowercased()):
          self.downloadMedia(url, isVideo: false) {
            self.sendText(url.absoluteString)
          }
        case let url as URL where error == nil:
          self.sendMedia(url, isVideo: false, providerTemp: false)
        case let image as UIImage where error == nil:
          self.sendUIImage(image, suggestedName: item.suggestedName)
        case let data as Data where error == nil:
          self.sendImageData(data, typeIdentifier: typeIdentifier, suggestedName: item.suggestedName)
        default:
          self.completeItemAndAppendManifestAndLogError(
            text:
              "loadImage: no file or loadable item for \(typeIdentifier) (got \(loaded.map { String(describing: type(of: $0)) } ?? "nil"))",
            error: error)
        }
      }
    }
  }

  // Providers register several representations for one item and the order is
  // arbitrary, not a preference — a provider can list public.url ahead of the
  // image itself. Rank so media always beats the link.
  private enum ItemKind: Int {
    case movie = 0
    case imageFile = 1
    case image = 2
    case vCard = 3
    case file = 4
    case text = 5
    case url = 6
  }

  private static func kind(forType stype: String) -> ItemKind? {
    guard let type = UTType(stype) else { return nil }
    if type.conforms(to: .movie) { return .movie }
    if type.conforms(to: .png) || type.conforms(to: .gif) || type.conforms(to: .jpeg)
      || stype == "public.heic"
    {
      return .imageFile
    }
    if type.conforms(to: .image) { return .image }
    if type.conforms(to: .vCard) { return .vCard }
    if type.conforms(to: .pdf) || type.conforms(to: .fileURL) { return .file }
    if type.conforms(to: .plainText) { return .text }
    if type.conforms(to: .url) { return .url }
    return nil
  }

  private static func bestType(for item: NSItemProvider) -> (stype: String, kind: ItemKind)? {
    var best: (stype: String, kind: ItemKind)?
    for stype in item.registeredTypeIdentifiers {
      guard let kind = Self.kind(forType: stype) else { continue }
      if best == nil || kind.rawValue < best!.kind.rawValue {
        best = (stype, kind)
      }
    }
    return best
  }

  private func incrementUnprocessed() {
    objc_sync_enter(self)
    unprocessed += 1
    objc_sync_exit(self)
  }

  @objc public func startProcessing() {
    // Handlers for different types
    let fileHandler: @Sendable (URL?, Error?) -> Void = { url, error in
      if let error {
        self.completeItemAndAppendManifestAndLogError(text: "fileHandler: load error", error: error)
        return
      }
      self.sendFile(url, providerTemp: true)
    }

    let movieHandler: @Sendable (URL?, Error?) -> Void = { url, error in
      self.sendMedia(error == nil ? url : nil, isVideo: true, providerTemp: true)
    }

    let contactHandler: @Sendable (Data?, Error?) -> Void = { data, error in
      if let data = data {
        self.sendContact(data)
      } else {
        self.completeItemAndAppendManifestAndLogError(
          text: "vcardHandler: unable to decode share",
          error: nil
        )
      }
    }

    let secureTextHandler: @Sendable (NSSecureCoding?, Error?) -> Void = { item, error in
      var text: String?
      if error == nil {
        if let str = item as? String {
          text = str
        } else if let url = item as? URL {
          text = url.absoluteString
          if text?.hasPrefix("file://") == true {
            let d = try? Data(contentsOf: url)
            text = d != nil ? String(data: d!, encoding: .utf8) : nil
          }
        } else if let data = item as? Data {
          text = String(data: data, encoding: .utf8)
        }
      }
      self.sendText(text ?? "")
    }

    for items in itemArrs as! [[NSItemProvider]] {
      // Only handle one from itemArrs if we're already processing
      objc_sync_enter(self)
      if unprocessed > 0 {
        objc_sync_exit(self)
        break
      }
      objc_sync_exit(self)

      for item in items {
        guard let best = Self.bestType(for: item) else { continue }
        itemCount += 1
        incrementUnprocessed()
        // Only the load*Representation calls hand back a Progress; loadItem
        // gives us nothing to observe, so those items count all at once.
        switch best.kind {
        case .movie:
          reserveItemProgress(loaderReportsProgress: true)
          attachLoaderProgress(
            item.loadFileRepresentation(
              forTypeIdentifier: best.stype, completionHandler: movieHandler))
        // All images are copied as-is, since decoding one can exceed the
        // extension's memory limit; the app transcodes what it can't send
        // (TIFF, RAW, webp...).
        case .imageFile, .image:
          reserveItemProgress(loaderReportsProgress: true)
          attachLoaderProgress(loadImage(item, typeIdentifier: best.stype))
        case .vCard:
          reserveItemProgress(loaderReportsProgress: true)
          attachLoaderProgress(
            item.loadDataRepresentation(
              forTypeIdentifier: "public.vcard", completionHandler: contactHandler))
        // PDF and generic files
        case .file:
          // A provider whose only file-ish representation is `public.file-url`
          // has no file representation to load: asking for one writes the URL's
          // property-list encoding to a temp file, and we would attach that
          // 200-byte blob instead of the document. Take the URL and copy what it
          // points at.
          if UTType(best.stype)?.conforms(to: .fileURL) == true {
            reserveItemProgress(loaderReportsProgress: false)
            item.loadItem(
              forTypeIdentifier: best.stype, options: nil,
              completionHandler: { (loaded: NSSecureCoding?, error: Error?) in
                self.sendURLItem(loaded as? URL)
              })
          } else {
            reserveItemProgress(loaderReportsProgress: true)
            attachLoaderProgress(
              item.loadFileRepresentation(
                forTypeIdentifier: best.stype, completionHandler: fileHandler))
          }
        case .text:
          reserveItemProgress(loaderReportsProgress: false)
          item.loadItem(
            forTypeIdentifier: "public.plain-text", options: nil,
            completionHandler: secureTextHandler)
        case .url:
          reserveItemProgress(loaderReportsProgress: false)
          item.loadItem(
            forTypeIdentifier: "public.url", options: nil,
            completionHandler: { (item: NSSecureCoding?, error: Error?) in
              self.sendURLItem(item as? URL)
            })
        }
      }
    }

    incrementUnprocessed()
    // Clean up if we didn't find anything
    DispatchQueue.main.async { [weak self] in
      self?.finishOneAlreadyInMainThread()
    }
  }
}
