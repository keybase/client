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
      // Note: Omitting outgoingMessageType - it can prevent suggestions from appearing on iPhone
      // (see https://stackoverflow.com/questions/78399660)
      let intent = INSendMessageIntent(
        recipients: nil,
        content: nil,
        speakableGroupName: groupName,
        conversationIdentifier: convID,
        serviceName: "Keybase",
        sender: nil,
        attachments: nil
      )

      // Non-team multi-participant: composite AvatarURL + AvatarURL2; else single avatar
      // Apple requires a non-nil image for share sheet suggestions to appear.
      if !avatarURL2.isEmpty, let url1 = URL(string: avatarURL), let url2 = URL(string: avatarURL2) {
        loadAndSetCombinedAvatar(url1: url1, url2: url2, intent: intent)
      } else if !avatarURL.isEmpty, let url = URL(string: avatarURL) {
        loadAndSetSingleAvatar(url: url, intent: intent)
      } else {
        setFallbackImage(intent: intent)
        donateIntent(intent)
      }
    }
  }

  private func loadAndSetSingleAvatar(url: URL, intent: INSendMessageIntent) {
    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      // Use Data(contentsOf:) for file URLs - more reliable than URLSession for local files
      let data = try? Data(contentsOf: url)
      if let data = data, UIImage(data: data) != nil {
        intent.setImage(INImage(imageData: data), forParameterNamed: \.speakableGroupName)
      } else {
        self?.setFallbackImage(intent: intent)
      }
      self?.donateIntent(intent)
    }
  }

  /// Loads two avatar URLs and composites them (like frontend Avatars: two overlapping circles).
  private func loadAndSetCombinedAvatar(url1: URL, url2: URL, intent: INSendMessageIntent) {
    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      let img1 = (try? Data(contentsOf: url1)).flatMap { UIImage(data: $0) }
      let img2 = (try? Data(contentsOf: url2)).flatMap { UIImage(data: $0) }
      var images: [UIImage] = []
      if let i1 = img1 { images.append(i1) }
      if let i2 = img2 { images.append(i2) }
      let combined = self?.compositeAvatarImages(images)
      if let img = combined, let data = img.pngData() {
        intent.setImage(INImage(imageData: data), forParameterNamed: \.speakableGroupName)
      } else {
        self?.setFallbackImage(intent: intent)
      }
      self?.donateIntent(intent)
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
  private func compositeAvatarImages(_ images: [UIImage]) -> UIImage? {
    guard !images.isEmpty else { return nil }
    let size: CGFloat = 192
    let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size))
    return renderer.image { ctx in
      let cgContext = ctx.cgContext
      let rect = CGRect(origin: .zero, size: CGSize(width: size, height: size))
      UIColor.white.setFill()
      ctx.fill(rect)
      let circleSize: CGFloat = size * 0.65
      let overlap: CGFloat = size * 0.35
      if images.count == 1 {
        images[0].draw(in: CGRect(x: (size - circleSize) / 2, y: (size - circleSize) / 2, width: circleSize, height: circleSize))
      } else {
        // Two overlapping circles like frontend: left (top-left), right (bottom-right)
        let leftRect = CGRect(x: 0, y: 0, width: circleSize, height: circleSize)
        let rightRect = CGRect(x: size - circleSize - overlap, y: size - circleSize - overlap, width: circleSize, height: circleSize)
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
