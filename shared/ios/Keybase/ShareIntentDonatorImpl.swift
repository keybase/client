//
//  ShareIntentDonatorImpl.swift
//  Keybase
//
//  Donates INSendMessageIntent for recent conversations to enable share sheet suggestions.
//

import Foundation
import Intents
import Keybasego
import UIKit

private struct ShareConversation: Decodable {
  let convID: String
  let name: String
  let avatarURL: String
  let avatarURL2: String

  enum CodingKeys: String, CodingKey {
    case convID = "ConvID"
    case name = "Name"
    case avatarURL = "AvatarURL"
    case avatarURL2 = "AvatarURL2"
  }
}

class ShareIntentDonatorImpl: NSObject, Keybasego.KeybaseShareIntentDonatorProtocol {
  /// Writes to stderr (fd 2) so output appears in ios.log after Go redirects stderr to the log file.
  /// NSLog uses os_log on iOS 10+ and does not go to stderr, so it never appears in ios.log.
  private static func logToStderr(_ message: String) {
    let line = "ShareIntentDonator: \(message)\n"
    if let data = line.data(using: .utf8) {
      FileHandle.standardError.write(data)
    }
  }

  func donateShareConversations(_ conversationsJSON: String?) {
    if conversationsJSON == nil {
      Self.logToStderr("donateShareConversations called with nil JSON")
      return
    }
    guard let conversationsJSON = conversationsJSON,
          let data = conversationsJSON.data(using: .utf8)
    else {
      Self.logToStderr("donateShareConversations: failed to get data from JSON")
      return
    }
    guard let conversations = try? JSONDecoder().decode([ShareConversation].self, from: data) else {
      Self.logToStderr("donateShareConversations: JSON decode failed, first 200 chars: \(String(conversationsJSON.prefix(200)))")
      return
    }
    guard !conversations.isEmpty else {
      Self.logToStderr("donateShareConversations: empty conversations array")
      return
    }
    Self.logToStderr("donateShareConversations: donating \(conversations.count) conversations")
    INInteraction.deleteAll { [weak self] _ in
      self?.donateConversations(conversations)
    }
  }

  private func donateConversations(_ conversations: [ShareConversation]) {
    for conv in conversations {
      let convID = conv.convID
      let name = conv.name
      let avatarURL = conv.avatarURL
      let avatarURL2 = conv.avatarURL2

      let groupName = INSpeakableString(spokenPhrase: name.isEmpty ? "Keybase" : name)
      let intent = INSendMessageIntent(
        recipients: nil,
        outgoingMessageType: .outgoingMessageText,
        content: nil,
        speakableGroupName: groupName,
        conversationIdentifier: convID,
        serviceName: "Keybase",
        sender: nil,
        attachments: nil
      )

      // Non-team multi-participant: composite AvatarURL + AvatarURL2; else single avatar
      // Apple requires a non-nil image for share sheet suggestions to appear.
      let urls: [URL] = {
        if !avatarURL2.isEmpty, let u1 = URL(string: avatarURL), let u2 = URL(string: avatarURL2) {
          return [u1, u2]
        }
        if !avatarURL.isEmpty, let u = URL(string: avatarURL) { return [u] }
        return []
      }()
      let onReady: () -> Void = { [weak self] in self?.donateIntent(intent) }
      if urls.isEmpty {
        setFallbackImage(intent: intent)
        onReady()
      } else {
        loadAvatars(urls: urls, intent: intent, completion: onReady)
      }
    }
  }

  /// Loads avatar URL(s) and composites them. Apple requires a non-nil image for share sheet suggestions.
  private func loadAvatars(urls: [URL], intent: INSendMessageIntent, completion: @escaping () -> Void) {
    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      let images = urls.compactMap { (try? Data(contentsOf: $0)).flatMap { UIImage(data: $0) } }
      if let combined = self?.compositeAvatarImages(images), let data = combined.pngData() {
        intent.setImage(INImage(imageData: data), forParameterNamed: \.speakableGroupName)
      } else {
        self?.setFallbackImage(intent: intent)
      }
      completion()
    }
  }

  /// Fallback image when avatar fetch fails. Apple requires a non-nil image for share sheet suggestions.
  private func setFallbackImage(intent: INSendMessageIntent) {
    let size: CGFloat = 64
    let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size))
    let image = renderer.image { ctx in
      UIColor.lightGray.setFill()
      ctx.fill(CGRect(origin: .zero, size: CGSize(width: size, height: size)))
    }
    if let data = image.pngData() {
      intent.setImage(INImage(imageData: data), forParameterNamed: \.speakableGroupName)
    }
  }

  /// Composites avatar images like frontend Avatars: two circles overlapping in a square.
  /// Single avatars fill the entire circle (full size, aspect fill); background is transparent.
  private func compositeAvatarImages(_ images: [UIImage]) -> UIImage? {
    guard !images.isEmpty else { return nil }
    let size: CGFloat = 192
    let circleSize = size * 0.65
    let leftRect = CGRect(origin: .zero, size: CGSize(width: circleSize, height: circleSize))
    let rightRect = CGRect(x: size - circleSize, y: size - circleSize, width: circleSize, height: circleSize)
    let fullRect = CGRect(origin: .zero, size: CGSize(width: size, height: size))
    let format = UIGraphicsImageRendererFormat()
    format.opaque = false
    let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size), format: format)
    return renderer.image { ctx in
      let cgContext = ctx.cgContext
      if images.count == 1 {
        let img = images[0]
        let imgSize = img.size
        let scale = max(size / imgSize.width, size / imgSize.height)
        let scaledW = imgSize.width * scale
        let scaledH = imgSize.height * scale
        let drawRect = CGRect(x: (size - scaledW) / 2, y: (size - scaledH) / 2, width: scaledW, height: scaledH)
        cgContext.saveGState()
        UIBezierPath(ovalIn: fullRect).addClip()
        img.draw(in: drawRect)
        cgContext.restoreGState()
      } else {
        cgContext.saveGState()
        UIBezierPath(ovalIn: leftRect).addClip()
        images[0].draw(in: leftRect)
        cgContext.restoreGState()
        cgContext.saveGState()
        UIBezierPath(ovalIn: rightRect).addClip()
        images[1].draw(in: rightRect)
        cgContext.restoreGState()
      }
    }
  }

  private func donateIntent(_ intent: INSendMessageIntent) {
    let interaction = INInteraction(intent: intent, response: nil)
    interaction.donate { error in
      if let error = error {
        ShareIntentDonatorImpl.logToStderr("donateIntent failed for \(intent.conversationIdentifier ?? "?"): \(error.localizedDescription)")
      }
    }
  }
}
