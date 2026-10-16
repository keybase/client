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
  private var captions: [String]
  private var payloadFolderURL: URL
  private var isShare: Bool
  private var done = false
  // What each attachment (and each host caption) came to, keyed by its place
  // in the share so text joins in the order it was shared. Main thread only.
  private var pieces: [(order: Int, piece: Piece)] = []
  private enum Piece {
    // an image, video or file entry
    case payload([String: Any])
    case text(String)
    // the host's own text for an extension item
    case caption(String)
    // the static description that was logged
    case failed(String)
  }
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

  // A download starts after the item load already reported done, so give it
  // its own slice of the bar instead of leaving it invisible. Resume from
  // inside the main-queue hop: starting the task first lets a fast download
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
  // app can say how many didn't make it. Set when the manifest is written.
  private var preparedItems: [[String: Any]] = []
  private var failedItems: [[String: Any]] = []

  // The attachments startProcessing set out to load, which is every one the
  // share carries. Main thread only.
  @objc public private(set) var itemCount = 0

  // Items that failed to load or copy. Valid once the manifest is written.
  // Main thread only.
  @objc public var failedCount: Int {
    return failedItems.count
  }

  // Whether anything finished that the share can send. Valid once the manifest
  // is written. Main thread only.
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

  // itemArrs holds each extension item's attachments; captions, when given,
  // the host's text for the same extension items (empty for none).
  @objc public init(
    forShare isShare: Bool, withItems itemArrs: [Any], captions: [String] = [],
    completionHandler: @escaping () -> Void
  ) {
    self.isShare = isShare
    self.itemArrs = itemArrs
    self.captions = captions
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
    pieces = []
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

  private func getManifestFileURL() -> URL {
    let incomingShareFolderURL = Self.getIncomingShareFolder()
    try? FileManager.default.createDirectory(
      at: incomingShareFolderURL, withIntermediateDirectories: true, attributes: nil)
    return incomingShareFolderURL.appendingPathComponent("manifest.json")
  }

  private func complete(_ order: Int, _ piece: Piece) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      self.pieces.append((order, piece))
      self.completeProcessingItemAlreadyInMainThread()
    }
  }

  private func completeItemAndAppendManifest(_ order: Int, type: String, originalFileURL: URL) {
    complete(order, .payload([
      "type": type,
      "originalPath": originalFileURL.absoluteURL.path,
    ]))
  }

  private func completeItemAndAppendManifestAndLogError(_ order: Int, text: String, error: Error?) {
    logFailure(text, error)
    complete(order, .failed(text))
  }

  private func logFailure(_ text: String, _ error: Error?) {
    let reason = error != nil ? String(describing: error!) : "<empty>"
    // The error can carry file paths, so only the static text is public.
    log.error("item failed: \(text, privacy: .public): \(reason, privacy: .private)")
  }

  // Media and files go as they are; the text, in share order, goes as one
  // message, which the app sends after the media when there is any. Text over
  // chat's limit is attached as a .txt instead.
  private func buildManifest() {
    var prepared: [[String: Any]] = []
    var failed: [String] = []
    var texts: [ShareText.Piece] = []
    for (_, piece) in pieces.sorted(by: { $0.order < $1.order }) {
      switch piece {
      case let .payload(entry): prepared.append(entry)
      case let .text(text): texts.append(.item(text))
      case let .caption(text): texts.append(.caption(text))
      case let .failed(text): failed.append(text)
      }
    }
    if let text = ShareText.message(from: texts, withMedia: !prepared.isEmpty) {
      if ShareText.fitsInline(text) {
        prepared.append(["type": "text", "content": text])
      } else {
        do {
          let url = try getPayloadURL(named: PayloadFileName.forText(text))
          try text.write(to: url, atomically: true, encoding: .utf8)
          prepared.append(["type": "text", "originalPath": url.absoluteURL.path])
        } catch {
          let what = "long text: unable to write payload file"
          logFailure(what, error)
          failed.append(what)
        }
      }
    }
    preparedItems = prepared
    // The service logs this, so it gets the static text only.
    failedItems = failed.map { ["type": "error", "error": $0] }
  }

  // Written even if empty so an older share's manifest can't be picked up.
  private func writeManifest() {
    buildManifest()
    writtenManifest = ShareFiles.writeManifest(preparedItems + failedItems, to: getManifestFileURL())
  }

  // For a share that won't open the app: its manifest would only be read by
  // some later, unrelated open. A manifest written since by another share is
  // kept. Main thread only.
  @objc public func removeManifest() {
    guard let written = writtenManifest else { return }
    ShareFiles.removeManifest(at: getManifestFileURL(), ifContents: written)
  }

  // Text and links are joined into one message when the manifest is written.
  // Blank text isn't something to share.
  private func sendText(_ order: Int, _ text: String) {
    if ShareText.isBlank(text) {
      completeItemAndAppendManifestAndLogError(order, text: "sendText: blank text", error: nil)
      return
    }
    complete(order, .text(text))
  }

  // providerTemp: url is a load*Representation temp file, ours to move until
  // the completion handler returns. Must be called before it returns. The
  // file keeps the provider's suggested name, with an extension for type.
  private func sendFile(
    _ order: Int, _ url: URL?, providerTemp: Bool, suggestedName: String? = nil, type: UTType? = nil
  ) {
    guard let url = url else {
      completeItemAndAppendManifestAndLogError(order, text: "sendFile: unable to decode share", error: nil)
      return
    }

    do {
      let filePayloadURL = try getPayloadURL(
        named: PayloadFileName.make(
          candidates: [suggestedName, url.lastPathComponent], type: type, fallbackBase: "file"))
      try ShareFiles.place(url, at: filePayloadURL, move: providerTemp)
      completeItemAndAppendManifest(order, type: "file", originalFileURL: filePayloadURL)
    } catch {
      completeItemAndAppendManifestAndLogError(order, text: "sendFile: copy error", error: error)
    }
  }

  private func sendContact(_ order: Int, _ vCardData: Data) {
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
        complete(order, .text(text))
      } else {
        completeItemAndAppendManifestAndLogError(
          order, text: "vcardHandler: unable to decode share", error: nil)
      }
    } catch {
      completeItemAndAppendManifestAndLogError(
        order, text: "vcardHandler: error processing vcard", error: error)
    }
  }

  // Bring the provider's file into our payload folder: a temp file is moved
  // (it's deleted when the completion handler returns), anything else copied.
  // The extension never transcodes: trimming and compression happen in the
  // app, which has no extension memory budget and can let the user edit before
  // encoding.
  private func sendMedia(_ order: Int, _ url: URL?, isVideo: Bool, providerTemp: Bool) {
    guard let url = url else {
      completeItemAndAppendManifestAndLogError(order, text: "sendMedia: unable to decode share", error: nil)
      return
    }

    let filePayloadURL: URL
    do {
      filePayloadURL = try getPayloadURL(from: url)
      try ShareFiles.place(url, at: filePayloadURL, move: providerTemp)
    } catch {
      completeItemAndAppendManifestAndLogError(order, text: "sendMedia: copy error", error: error)
      return
    }
    completeItemAndAppendManifest(order, type: isVideo ? "video" : "image", originalFileURL: filePayloadURL)
  }

  // A URL item is not necessarily a web link: providers also vend local files
  // this way, and those go by their real content type, never as a pasted
  // path. A web link may point at media (see sendRemoteURL).
  private func sendURLItem(_ order: Int, _ url: URL?) {
    guard let url = url else {
      completeItemAndAppendManifestAndLogError(order, text: "sendURLItem: unable to decode share", error: nil)
      return
    }
    guard url.isFileURL else {
      sendRemoteURL(order, url)
      return
    }

    let scoped = url.startAccessingSecurityScopedResource()
    defer { if scoped { url.stopAccessingSecurityScopedResource() } }

    let type = (try? url.resourceValues(forKeys: [.contentTypeKey]))?.contentType
      ?? UTType(filenameExtension: url.pathExtension)
    if type?.conforms(to: .movie) == true {
      sendMedia(order, url, isVideo: true, providerTemp: false)
    } else if type?.conforms(to: .image) == true {
      sendMedia(order, url, isVideo: false, providerTemp: false)
    } else {
      // Text files too: a .txt, .csv or .md the user picked is a document with
      // a name, not text to paste.
      sendFile(order, url, providerTemp: false)
    }
  }

  // Safari's long-press-image share hands over the image's web address, not the
  // image, so the only way to attach the picture the user pointed at is to
  // fetch it. A link whose path doesn't name an image or video is probed with
  // HEAD first, so an ordinary link share doesn't download a whole page before
  // falling back to sending the link.
  private static let probeTimeout: TimeInterval = 6
  private static let downloadTimeout: TimeInterval = 30

  private func sendRemoteURL(_ order: Int, _ url: URL) {
    let sendLink: () -> Void = { [weak self] in self?.sendText(order, url.absoluteString) }

    if let type = UTType(filenameExtension: url.pathExtension.lowercased()),
      type.conforms(to: .image) || type.conforms(to: .movie)
    {
      downloadMedia(order, url, isVideo: type.conforms(to: .movie), sendLink: sendLink)
      return
    }

    var head = URLRequest(url: url, timeoutInterval: Self.probeTimeout)
    head.httpMethod = "HEAD"
    URLSession.shared.dataTask(with: head) { [weak self] _, response, _ in
      guard let self = self else { return }
      let mime = response?.mimeType ?? ""
      if mime.hasPrefix("image/") || mime.hasPrefix("video/") {
        self.downloadMedia(order, url, isVideo: mime.hasPrefix("video/"), sendLink: sendLink)
      } else {
        sendLink()
      }
    }.resume()
  }

  // The body goes to a file, never memory, so a large video can't push the
  // extension past its memory limit. Past ShareDownload.maxBytes the download
  // is cancelled and the link shared instead.
  private func downloadMedia(_ order: Int, _ url: URL, isVideo: Bool, sendLink: @escaping () -> Void) {
    let request = URLRequest(url: url, timeoutInterval: Self.downloadTimeout)
    let watches = DownloadWatches()
    let task = URLSession.shared.downloadTask(with: request) { [weak self] location, response, error in
      watches.stop()
      guard let self = self else { return }
      let mime = response?.mimeType ?? ""
      guard error == nil, let location = location,
        mime.isEmpty || mime.hasPrefix("image/") || mime.hasPrefix("video/")
      else {
        sendLink()
        return
      }
      let size = (try? location.resourceValues(forKeys: [.fileSizeKey]))?.fileSize ?? 0
      guard size > 0, !ShareDownload.overCap(expected: -1, received: Int64(size)) else {
        if size > 0 {
          log.info("download of \(size) bytes is over the cap; sharing the link")
        }
        sendLink()
        return
      }
      // URLSession deletes its file when this handler returns, so it is moved
      // first; the rest runs off the session's queue, as writing out a video is
      // enough file I/O to stall the extension's UI.
      let staged = FileManager.default.temporaryDirectory
        .appendingPathComponent(ProcessInfo.processInfo.globallyUniqueString)
      guard (try? FileManager.default.moveItem(at: location, to: staged)) != nil else {
        sendLink()
        return
      }
      DispatchQueue.global(qos: .userInitiated).async {
        defer { try? FileManager.default.removeItem(at: staged) }
        self.writeDownloadedMedia(
          order, at: staged, from: url, mime: mime, isVideo: isVideo || mime.hasPrefix("video/"),
          sendLink: sendLink)
      }
    }
    // Stopped as soon as it is known to be too big: from the announced length,
    // or as the bytes arrive. The cancel lands in the handler above, which
    // shares the link.
    let stopIfOverCap: (URLSessionDownloadTask) -> Void = { task in
      guard ShareDownload.overCap(expected: task.countOfBytesExpectedToReceive, received: task.countOfBytesReceived)
      else { return }
      log.info("download is over the cap; sharing the link")
      task.cancel()
    }
    watches.start([
      task.observe(\.countOfBytesExpectedToReceive) { task, _ in stopIfOverCap(task) },
      task.observe(\.countOfBytesReceived) { task, _ in stopIfOverCap(task) },
    ])
    startTracked(task)
  }

  private func writeDownloadedMedia(
    _ order: Int, at file: URL, from url: URL, mime: String, isVideo: Bool, sendLink: @escaping () -> Void
  ) {
    let name: String
    let type: String
    if isVideo {
      name = PayloadFileName.downloadedVideo(from: url, mime: mime)
      type = "video"
    } else {
      // Written as served. Decoding a large image would blow the extension's
      // memory limit, so anything the app can't show as-is (webp, avif) is
      // transcoded there. The bytes, not the label, decide: a server can serve an
      // error page as image/*, and then the link is the better share. Mapped, so
      // the sniff reads only the header.
      guard let data = try? Data(contentsOf: file, options: .alwaysMapped),
        let imageType = ShareFiles.imageType(of: data),
        imageType.preferredFilenameExtension != nil
      else {
        sendLink()
        return
      }
      name = PayloadFileName.make(
        candidates: [url.lastPathComponent], type: imageType, fallbackBase: "image")
      type = "image"
    }
    guard let payloadURL = try? getPayloadURL(named: name),
      (try? FileManager.default.moveItem(at: file, to: payloadURL)) != nil
    else {
      sendLink()
      return
    }
    completeItemAndAppendManifest(order, type: type, originalFileURL: payloadURL)
  }

  // A provider that vends the image as bytes rather than a file (Safari's
  // image pages). Written as-is.
  private func sendImageData(_ order: Int, _ data: Data, typeIdentifier: String, suggestedName: String?) {
    guard let type = ShareFiles.imageType(of: data) ?? UTType(typeIdentifier),
      type.preferredFilenameExtension != nil
    else {
      completeItemAndAppendManifestAndLogError(
        order, text: "sendImageData: \(data.count) bytes of unknown image type \(ShareItemKind.publicDescription(of: [typeIdentifier]))",
        error: nil)
      return
    }
    let name = PayloadFileName.make(candidates: [suggestedName], type: type, fallbackBase: "image")
    do {
      let payloadURL = try getPayloadURL(named: name)
      try data.write(to: payloadURL, options: .atomic)
      completeItemAndAppendManifest(order, type: "image", originalFileURL: payloadURL)
    } catch {
      completeItemAndAppendManifestAndLogError(order, text: "sendImageData: write error", error: error)
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
  private func sendUIImage(_ order: Int, _ image: UIImage, suggestedName: String?) {
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
      completeItemAndAppendManifest(order, type: "image", originalFileURL: payloadURL)
    } catch {
      completeItemAndAppendManifestAndLogError(order, text: "sendUIImage: unable to encode share", error: error)
    }
  }

  // Every image goes through here. A file representation is the cheap path: the
  // provider's file is moved, never decoded. Two kinds of provider don't get
  // there. One vends only an in-memory UIImage. The other is Safari sharing an
  // image page, which vends the image as bytes: asking for a file makes
  // NSItemProvider write those bytes to a temp file and copy it, and that copy
  // intermittently fails with a nil error ("Failed to copy item ... to
  // temporary folder"). loadItem hands back the object itself either way.
  private func loadImage(_ order: Int, _ item: NSItemProvider, typeIdentifier: String) -> Progress {
    return item.loadFileRepresentation(forTypeIdentifier: typeIdentifier) { url, error in
      if let url = url, error == nil {
        self.sendMedia(order, url, isVideo: false, providerTemp: true)
        return
      }
      // Cancel and the watchdog cancel the loads; don't start another.
      if (error as? CocoaError)?.code == .userCancelled {
        self.completeItemAndAppendManifestAndLogError(order, text: "loadImage: cancelled", error: error)
        return
      }
      log.info(
        "loadFileRepresentation(\(ShareItemKind.publicDescription(of: [typeIdentifier]), privacy: .public)) failed (\(String(describing: error), privacy: .private)); loading the item instead"
      )
      item.loadItem(forTypeIdentifier: typeIdentifier, options: nil) { loaded, error in
        switch loaded {
        // Some providers vend the image's web address as the image item.
        case let url as URL where error == nil && ["http", "https"].contains(url.scheme?.lowercased()):
          self.downloadMedia(order, url, isVideo: false) {
            self.sendText(order, url.absoluteString)
          }
        case let url as URL where error == nil:
          self.sendMedia(order, url, isVideo: false, providerTemp: false)
        case let image as UIImage where error == nil:
          self.sendUIImage(order, image, suggestedName: item.suggestedName)
        case let data as Data where error == nil:
          self.sendImageData(order, data, typeIdentifier: typeIdentifier, suggestedName: item.suggestedName)
        default:
          self.completeItemAndAppendManifestAndLogError(
            order,
            text:
              "loadImage: no file or loadable item for \(ShareItemKind.publicDescription(of: [typeIdentifier])) (got \(loaded.map { String(describing: type(of: $0)) } ?? "nil"))",
            error: error)
        }
      }
    }
  }

  private func incrementUnprocessed() {
    objc_sync_enter(self)
    unprocessed += 1
    objc_sync_exit(self)
  }

  // A text item: a string, a link, or (from some hosts) a file, which is sent
  // as the file it is rather than read into the message.
  private func sendTextItem(_ order: Int, _ item: NSSecureCoding?, _ error: Error?) {
    switch item {
    case let str as String where error == nil:
      sendText(order, str)
    case let url as URL where error == nil && url.isFileURL:
      sendURLItem(order, url)
    case let url as URL where error == nil:
      sendText(order, url.absoluteString)
    case let data as Data where error == nil:
      guard let str = String(data: data, encoding: .utf8) else {
        completeItemAndAppendManifestAndLogError(order, text: "sendTextItem: text isn't UTF-8", error: nil)
        return
      }
      sendText(order, str)
    default:
      completeItemAndAppendManifestAndLogError(order, text: "sendTextItem: unable to decode share", error: error)
    }
  }

  // A link item, which some providers vend as a string or its bytes.
  // Text that doesn't parse as a URL is still the user's text, and goes as
  // text.
  private func sendLinkItem(_ order: Int, _ item: NSSecureCoding?, _ error: Error?) {
    var str: String?
    if error == nil {
      switch item {
      case let u as URL:
        sendURLItem(order, u)
        return
      case let s as String: str = s
      case let data as Data: str = String(data: data, encoding: .utf8)
      default: break
      }
    }
    guard let str else {
      sendURLItem(order, nil)
      return
    }
    if let url = URL(string: str.trimmingCharacters(in: .whitespacesAndNewlines)) {
      sendURLItem(order, url)
    } else {
      sendText(order, str)
    }
  }

  @objc public func startProcessing() {
    var order = 0
    for (index, items) in (itemArrs as! [[NSItemProvider]]).enumerated() {
      // The host's own text for this extension item (a post's caption, a
      // page's title) goes ahead of its attachments.
      if index < captions.count, !ShareText.isBlank(captions[index]) {
        pieces.append((order, .caption(captions[index])))
      }
      order += 1

      for item in items {
        let itemOrder = order
        order += 1
        itemCount += 1
        incrementUnprocessed()
        let types = item.registeredTypeIdentifiers
        guard let best = ShareItemKind.best(of: types) else {
          reserveItemProgress(loaderReportsProgress: false)
          completeItemAndAppendManifestAndLogError(itemOrder, text: "item offers no types", error: nil)
          continue
        }
        log.log(
          "item \(itemOrder, privacy: .public) offers \(ShareItemKind.publicDescription(of: types), privacy: .public) (\(types, privacy: .private)); loading \(String(describing: best.kind), privacy: .public)"
        )
        // Only the load*Representation calls hand back a Progress; loadItem
        // gives us nothing to observe, so those items count all at once.
        switch best.kind {
        case .movie:
          reserveItemProgress(loaderReportsProgress: true)
          attachLoaderProgress(
            item.loadFileRepresentation(forTypeIdentifier: best.stype) { url, error in
              self.sendMedia(itemOrder, error == nil ? url : nil, isVideo: true, providerTemp: true)
            })
        // All images are copied as-is, since decoding one can exceed the
        // extension's memory limit; the app transcodes what it can't send
        // (TIFF, RAW, webp...).
        case .imageFile, .image:
          reserveItemProgress(loaderReportsProgress: true)
          attachLoaderProgress(loadImage(itemOrder, item, typeIdentifier: best.stype))
        case .vCard:
          reserveItemProgress(loaderReportsProgress: true)
          attachLoaderProgress(
            item.loadDataRepresentation(forTypeIdentifier: "public.vcard") { data, error in
              if let data = data {
                self.sendContact(itemOrder, data)
              } else {
                self.completeItemAndAppendManifestAndLogError(
                  itemOrder, text: "vcardHandler: unable to decode share", error: error)
              }
            })
        // A provider whose only file-ish representation is `public.file-url`
        // has no file representation to load: asking for one writes the URL's
        // property-list encoding to a temp file, and we would attach that
        // 200-byte blob instead of the document. Take the URL and copy what it
        // points at.
        case .file where UTType(best.stype)?.conforms(to: .fileURL) == true:
          reserveItemProgress(loaderReportsProgress: false)
          item.loadItem(forTypeIdentifier: best.stype, options: nil) { loaded, error in
            self.sendURLItem(itemOrder, error == nil ? loaded as? URL : nil)
          }
        // PDFs, and anything else a host offers (audio, documents, archives,
        // types we have never heard of), go as files under the provider's name.
        case .file, .data:
          let stype = best.stype
          let suggestedName = item.suggestedName
          reserveItemProgress(loaderReportsProgress: true)
          attachLoaderProgress(
            item.loadFileRepresentation(forTypeIdentifier: stype) { url, error in
              if let error {
                self.completeItemAndAppendManifestAndLogError(itemOrder, text: "fileHandler: load error", error: error)
                return
              }
              self.sendFile(
                itemOrder, url, providerTemp: true, suggestedName: suggestedName, type: UTType(stype))
            })
        case .text:
          reserveItemProgress(loaderReportsProgress: false)
          item.loadItem(forTypeIdentifier: "public.plain-text", options: nil) { loaded, error in
            self.sendTextItem(itemOrder, loaded, error)
          }
        case .url:
          reserveItemProgress(loaderReportsProgress: false)
          item.loadItem(forTypeIdentifier: "public.url", options: nil) { loaded, error in
            self.sendLinkItem(itemOrder, loaded, error)
          }
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

// Keeps a download's observations alive until its completion handler, which
// may run on another queue, stops them.
private final class DownloadWatches: @unchecked Sendable {
  private let lock = NSLock()
  private var observations: [NSKeyValueObservation] = []

  func start(_ added: [NSKeyValueObservation]) {
    lock.lock()
    observations = added
    lock.unlock()
  }

  func stop() {
    lock.lock()
    let stopping = observations
    observations = []
    lock.unlock()
    stopping.forEach { $0.invalidate() }
  }
}
