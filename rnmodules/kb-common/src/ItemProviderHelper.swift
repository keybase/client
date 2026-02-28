import AVFoundation
import Contacts
import Foundation
import UIKit
import UniformTypeIdentifiers


@objc(ItemProviderHelper)
public class ItemProviderHelper: NSObject {
  private var itemArrs: [Any]
  private var payloadFolderURL: URL
  private var isShare: Bool
  private var done = false
  private var typeToArray: [String: [[String: Any]]] = [:]
  private var completionHandler: () -> Void
  private var unprocessed: Int = 0
  
  @objc public var manifest: [[String: Any]] {
    // reconcile what we're sending over. types=text, url, video, image, file, error
    var toWrite: [[String: Any]] = []
    let urls = typeToArray["url"]
    
    // We treat all text that has http in it a url, we take the longest one as its
    // likely most descriptive
    if let urls = urls {
      var content = urls.first?["content"] as? String ?? ""
      for url in urls {
        if let c = url["content"] as? String, c.count > content.count {
          content = c
        }
      }
      toWrite.append([
        "type": "text",
        "content": content
      ])
    } else {
      let images = typeToArray["image"] ?? []
      let videos = typeToArray["video"] ?? []
      let files = typeToArray["file"] ?? []
      let texts = typeToArray["text"] ?? []
      
      // If we have media, ignore text, we want to attach stuff and not also
      // inject into the input box
      if !images.isEmpty || !videos.isEmpty || !files.isEmpty {
        toWrite.append(contentsOf: images)
        toWrite.append(contentsOf: videos)
        toWrite.append(contentsOf: files)
      } else if !texts.isEmpty {
        // Likely just one piece of text
        toWrite.append(texts[0])
      }
    }
    
    return toWrite
  }
  
  @objc public init(forShare isShare: Bool, withItems itemArrs: [Any], completionHandler: @escaping () -> Void) {
    self.isShare = isShare
    self.itemArrs = itemArrs
    self.completionHandler = completionHandler
    self.payloadFolderURL = Self.makePayloadFolder()
  }
  
  private func completeProcessingItemAlreadyInMainThread() {
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
  
  private static func getIncomingShareFolder() -> URL {
    let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.keybase")!
    // Use the cache URL so if we fail to clean up payloads they can be deleted by
    // the OS.
    let cacheURL = containerURL.appendingPathComponent("Library", isDirectory: true)
      .appendingPathComponent("Caches", isDirectory: true)
    let incomingShareFolderURL = cacheURL.appendingPathComponent("incoming-shares", isDirectory: true)
    return incomingShareFolderURL
  }
  
  private static func makePayloadFolder() -> URL {
    let incomingShareFolderURL = getIncomingShareFolder()
    let guid = ProcessInfo.processInfo.globallyUniqueString
    let payloadFolderURL = incomingShareFolderURL.appendingPathComponent(guid, isDirectory: true)
    try? FileManager.default.createDirectory(at: payloadFolderURL, withIntermediateDirectories: true, attributes: nil)
    return payloadFolderURL
  }
  
  private func getPayloadURL(from url: URL?) -> URL {
    let guid = ProcessInfo.processInfo.globallyUniqueString
    return url != nil ? payloadFolderURL.appendingPathComponent(url!.lastPathComponent)
    : payloadFolderURL.appendingPathComponent(guid)
  }
  
  private func getPayloadURL(withExtension ext: String?) -> URL {
    let guid = ProcessInfo.processInfo.globallyUniqueString
    return ext != nil ? payloadFolderURL.appendingPathComponent(guid).appendingPathExtension(ext!)
    : payloadFolderURL.appendingPathComponent(guid)
  }
  
  private func getManifestFileURL() -> URL {
    let incomingShareFolderURL = Self.getIncomingShareFolder()
    try? FileManager.default.createDirectory(at: incomingShareFolderURL, withIntermediateDirectories: true, attributes: nil)
    return incomingShareFolderURL.appendingPathComponent("manifest.json")
  }
  
  private func ensureArray(ofType type: String) -> [[String: Any]] {
    if typeToArray[type] == nil {
      typeToArray[type] = []
    }
    return typeToArray[type]!
  }
  
  private func completeItemAndAppendManifest(type: String, originalFileURL: URL) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      var arr = self.ensureArray(ofType: type)
      arr.append([
        "type": type,
        "originalPath": originalFileURL.absoluteURL.path
      ])
      self.typeToArray[type] = arr
      self.completeProcessingItemAlreadyInMainThread()
    }
  }
  
  private func completeItemAndAppendManifest(type: String, content: String) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      var arr = self.ensureArray(ofType: type)
      arr.append([
        "type": type,
        "content": content
      ])
      self.typeToArray[type] = arr
      self.completeProcessingItemAlreadyInMainThread()
    }
  }
  
  private func completeItemAndAppendManifest(type: String, originalFileURL: URL, content: String) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      var arr = self.ensureArray(ofType: type)
      arr.append([
        "type": type,
        "originalPath": originalFileURL.absoluteURL.path,
        "content": content
      ])
      self.typeToArray[type] = arr
      self.completeProcessingItemAlreadyInMainThread()
    }
  }
  
  private func completeItemAndAppendManifest(type: String, originalFileURL: URL, scaledFileURL: URL) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      var arr = self.ensureArray(ofType: type)
      arr.append([
        "type": type,
        "originalPath": originalFileURL.absoluteURL.path,
        "scaledPath": scaledFileURL.absoluteURL.path
      ])
      self.typeToArray[type] = arr
      self.completeProcessingItemAlreadyInMainThread()
    }
  }
  
  private func completeItemAndAppendManifestAndLogError(text: String, error: Error?) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      var arr = self.ensureArray(ofType: "error")
      arr.append([
        "error": "\(text): \(error != nil ? String(describing: error!) : "<empty>")"
      ])
      self.typeToArray["error"] = arr
      self.completeProcessingItemAlreadyInMainThread()
    }
  }
  
  private func writeManifest() {
    let toWrite = manifest
    let fileURL = getManifestFileURL()
    // write even if empty so we don't keep old manifests around
    if let outputStream = OutputStream(url: fileURL, append: false) {
      outputStream.open()
      defer { outputStream.close() }
      JSONSerialization.writeJSONObject(toWrite, to: outputStream, options: [], error: nil)
    }
  }
  
  private func handleAndCompleteMediaFile(_ url: URL, isVideo: Bool) {
    if isVideo {
      MediaUtils.processVideo(fromOriginal: url) { error, scaled in
        if let error = error {
          self.completeItemAndAppendManifestAndLogError(text: "handleAndCompleteMediaFile", error: error)
          return
        }
        self.completeItemAndAppendManifest(type: isVideo ? "video" : "image",
                                           originalFileURL: url,
                                           scaledFileURL: scaled!)
      }
    } else {
      MediaUtils.processImage(fromOriginal: url) { error, scaled in
        if let error = error {
          self.completeItemAndAppendManifestAndLogError(text: "handleAndCompleteMediaFile", error: error)
          return
        }
        self.completeItemAndAppendManifest(type: isVideo ? "video" : "image",
                                           originalFileURL: url,
                                           scaledFileURL: scaled!)
      }
    }
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
      completeItemAndAppendManifestAndLogError(text: "sendText: unable to write payload file", error: error)
    }
  }
  
  private func sendFile(_ url: URL?) {
    guard let url = url else {
      completeItemAndAppendManifestAndLogError(text: "sendFile: unable to decode share", error: nil)
      return
    }
    
    let filePayloadURL = getPayloadURL(from: url)
    do {
      try FileManager.default.copyItem(at: url, to: filePayloadURL)
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
        if let fullName = CNContactFormatter.string(from: contact, style: .fullName), !fullName.isEmpty {
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
        completeItemAndAppendManifestAndLogError(text: "vcardHandler: unable to decode share", error: nil)
      }
    } catch {
      completeItemAndAppendManifestAndLogError(text: "vcardHandler: error processing vcard", error: error)
    }
  }
  
  private func sendMovie(_ url: URL?) {
    var filePayloadURL: URL?
    var error: Error?
    
    if let url = url {
      filePayloadURL = getPayloadURL(from: url)
      do {
        try FileManager.default.copyItem(at: url, to: filePayloadURL!)
      } catch let copyError {
        error = copyError
      }
    }
    
    if let filePayloadURL = filePayloadURL, error == nil {
      handleAndCompleteMediaFile(filePayloadURL, isVideo: true)
    } else {
      completeItemAndAppendManifestAndLogError(text: "movieFileHandlerSimple2: copy error", error: error)
    }
  }
  
  private func sendImage(_ imgData: Data?) {
    if let imgData = imgData {
      let originalFileURL = getPayloadURL(withExtension: "jpg")
      let OK = (try? imgData.write(to: originalFileURL, options: .atomic)) != nil
      if OK {
        handleAndCompleteMediaFile(originalFileURL, isVideo: false)
        return
      }
    }
    
    completeItemAndAppendManifestAndLogError(text: "coerceImageHandlerSimple2: unable to decode share", error: nil)
  }
  
  private func incrementUnprocessed() {
    objc_sync_enter(self)
    unprocessed += 1
    objc_sync_exit(self)
  }
  
  @objc public func startProcessing() {
    // Handlers for different types
    let fileHandler: @Sendable (URL?, Error?) -> Void = { url, error in
        self.sendFile(url)
    }
    
    let movieHandler: @Sendable (URL?, Error?) -> Void = { url, error in
        self.sendMovie(error == nil ? url : nil)
    }
    
    let imageHandler: @Sendable (NSSecureCoding?, Error?) -> Void = { item, error in
        var imgData: Data? // Changed to var so we can modify it
        if error == nil {
            if let url = item as? URL {
                imgData = try? Data(contentsOf: url)
                if let data = imgData {
                    let image = UIImage(data: data)
                    imgData = image?.jpegData(compressionQuality: 0.85)
                }
            } else if let image = item as? UIImage {
                imgData = image.jpegData(compressionQuality: 0.85)
            }
        }
        self.sendImage(imgData)
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
        var text: String? // Changed to var so we can modify it
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

    // Rest of the method remains the same...
    for items in itemArrs as! [[NSItemProvider]] {
        // Only handle one from itemArrs if we're already processing
        objc_sync_enter(self)
        if unprocessed > 0 {
            objc_sync_exit(self)
            break
        }
        objc_sync_exit(self)
        
        for item in items {
            for stype in item.registeredTypeIdentifiers {
                guard let type = UTType(stype) else { continue }
                
                // Movies
                if type.conforms(to: .movie) {
                    incrementUnprocessed()
                    item.loadFileRepresentation(forTypeIdentifier: stype, completionHandler: movieHandler)
                    break
                }
                // Images (PNG, GIF, JPEG)
                else if type.conforms(to: .png) || type.conforms(to: .gif) || type.conforms(to: .jpeg) {
                    incrementUnprocessed()
                    item.loadFileRepresentation(forTypeIdentifier: stype, completionHandler: fileHandler)
                    break
                }
                // HEIC Images
                else if stype == "public.heic" {
                    incrementUnprocessed()
                    item.loadFileRepresentation(forTypeIdentifier: "public.heic", completionHandler: fileHandler)
                    break
                }
                // Other Images (coerce)
                else if type.conforms(to: .image) {
                    incrementUnprocessed()
                    item.loadItem(forTypeIdentifier: "public.image", options: nil, completionHandler: imageHandler)
                    break
                }
                // Contact cards
                else if type.conforms(to: .vCard) {
                    incrementUnprocessed()
                    item.loadDataRepresentation(forTypeIdentifier: "public.vcard", completionHandler: contactHandler)
                    break
                }
                // Plain Text (two attempts - direct and coerced)
                else if type.conforms(to: .plainText) {
                    incrementUnprocessed()
                  item.loadItem(forTypeIdentifier: "public.plain-text", options: nil, completionHandler: { (item: NSSecureCoding?, error: Error?) in
                      let text = item as? String ?? ""
                      self.sendText(text)
                  })

                    
                    incrementUnprocessed()
                    item.loadItem(forTypeIdentifier: "public.plain-text", options: nil, completionHandler: secureTextHandler)
                    break
                }
                // Files (PDF, generic files)
                else if type.conforms(to: .pdf) || type.conforms(to: .fileURL) {
                    incrementUnprocessed()
                    item.loadFileRepresentation(forTypeIdentifier: "public.item", completionHandler: fileHandler)
                    break
                }
                // URLs
                else if type.conforms(to: .url) {
                    incrementUnprocessed()
                    item.loadItem(forTypeIdentifier: "public.url", options: nil, completionHandler: { (item: NSSecureCoding?, error: Error?) in
                      let url = item as? URL
                      self.sendText(url?.absoluteString ?? "")
                  })

                    break
                }
            }
        }
    }
    
    incrementUnprocessed()
    // Clean up if we didn't find anything
    DispatchQueue.main.async { [weak self] in
        self?.completeProcessingItemAlreadyInMainThread()
    }
}
}
