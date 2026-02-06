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
  func deleteAllDonations() {
    INInteraction.deleteAll { _ in }
    NSLog("ShareIntentDonator: deleteAllDonations completed")
  }

  func deleteDonationByConversationID(_ conversationID: String) {
    INInteraction.delete(with: conversationID, completion: nil)
    NSLog("ShareIntentDonator: deleteDonation completed for %@", conversationID)
  }

  func donateShareConversations(_ conversationsJSON: String?) {
    guard let json = conversationsJSON, let data = json.data(using: .utf8) else {
      NSLog("ShareIntentDonator: donateShareConversations: nil or invalid JSON")
      return
    }
    guard let conversations = try? JSONDecoder().decode([ShareConversation].self, from: data) else {
      NSLog("ShareIntentDonator: donateShareConversations: JSON decode failed")
      return
    }
    guard !conversations.isEmpty else {
      NSLog("ShareIntentDonator: donateShareConversations: empty conversations array")
      return
    }
    NSLog("ShareIntentDonator: donateShareConversations: donating %d conversations", conversations.count)
    self?.donateConversations(conversations)
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
      let urls = Self.avatarURLs(avatarURL: avatarURL, avatarURL2: avatarURL2)
      let onReady = { [weak self] in _ = self?.donateIntent(intent) }
      if urls.isEmpty {
        setFallbackImage(intent: intent)
        onReady()
      } else {
        loadAvatars(urls: urls, intent: intent, completion: onReady)
      }
    }
  }

  /// Returns avatar URL(s) for composite: two URLs if both present (multi-participant), else one.
  private static func avatarURLs(avatarURL: String, avatarURL2: String) -> [URL] {
    if !avatarURL2.isEmpty, let u1 = URL(string: avatarURL), let u2 = URL(string: avatarURL2) {
      return [u1, u2]
    }
    if !avatarURL.isEmpty, let u = URL(string: avatarURL) { return [u] }
    return []
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
        self.drawImageInCircle(img, in: fullRect, drawRect: drawRect, context: cgContext)
      } else {
        self.drawImageInCircle(images[0], in: leftRect, drawRect: leftRect, context: cgContext)
        self.drawImageInCircle(images[1], in: rightRect, drawRect: rightRect, context: cgContext)
      }
    }
  }

  /// Draws an image clipped to an oval. Uses aspect fill when drawRect differs from clip rect.
  private func drawImageInCircle(_ image: UIImage, in clipRect: CGRect, drawRect: CGRect, context: CGContext) {
    context.saveGState()
    UIBezierPath(ovalIn: clipRect).addClip()
    image.draw(in: drawRect)
    context.restoreGState()
  }

  private func donateIntent(_ intent: INSendMessageIntent) {
    let interaction = INInteraction(intent: intent, response: nil)
    interaction.donate { error in
      if let error = error {
        NSLog("ShareIntentDonator: donateIntent failed for %@: %@", intent.conversationIdentifier ?? "?", error.localizedDescription)
      }
    }
  }
}
