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
  func donateShareConversations(_ conversationsJSON: String?) {
    if conversationsJSON == nil {
      NSLog("[ShareIntentDonator] donateShareConversations called with nil JSON")
      return
    }
    guard let conversationsJSON = conversationsJSON,
          let data = conversationsJSON.data(using: .utf8)
    else {
      NSLog("[ShareIntentDonator] donateShareConversations: failed to get data from JSON")
      return
    }
    guard let conversations = try? JSONDecoder().decode([ShareConversation].self, from: data) else {
      NSLog("[ShareIntentDonator] donateShareConversations: JSON decode failed, first 200 chars: %@", String(conversationsJSON.prefix(200)))
      return
    }
    guard !conversations.isEmpty else {
      NSLog("[ShareIntentDonator] donateShareConversations: empty conversations array")
      return
    }
    NSLog("[ShareIntentDonator] donateShareConversations: donating %d conversations", conversations.count)
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
      if !avatarURL2.isEmpty, let url1 = URL(string: avatarURL), let url2 = URL(string: avatarURL2) {
        loadAndSetCombinedAvatar(url1: url1, url2: url2, intent: intent)
      } else if !avatarURL.isEmpty, let url = URL(string: avatarURL) {
        loadAndSetSingleAvatar(url: url, intent: intent)
      } else {
        donateIntent(intent)
      }
    }
  }

  private func loadAndSetSingleAvatar(url: URL, intent: INSendMessageIntent) {
    URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
      if let data = data, let image = UIImage(data: data) {
        intent.setImage(INImage(imageData: data), forParameterNamed: \.speakableGroupName)
      }
      self?.donateIntent(intent)
    }.resume()
  }

  /// Loads two avatar URLs and composites them (like frontend Avatars: two overlapping circles).
  private func loadAndSetCombinedAvatar(url1: URL, url2: URL, intent: INSendMessageIntent) {
    let group = DispatchGroup()
    var img1: UIImage?
    var img2: UIImage?
    let lock = NSLock()
    group.enter()
    URLSession.shared.dataTask(with: url1) { data, _, _ in
      defer { group.leave() }
      if let data = data, let img = UIImage(data: data) {
        lock.lock()
        img1 = img
        lock.unlock()
      }
    }.resume()
    group.enter()
    URLSession.shared.dataTask(with: url2) { data, _, _ in
      defer { group.leave() }
      if let data = data, let img = UIImage(data: data) {
        lock.lock()
        img2 = img
        lock.unlock()
      }
    }.resume()
    group.notify(queue: .global(qos: .userInitiated)) { [weak self] in
      var images: [UIImage] = []
      lock.lock()
      if let i1 = img1 { images.append(i1) }
      if let i2 = img2 { images.append(i2) }
      lock.unlock()
      let combined = self?.compositeAvatarImages(images)
      if let img = combined, let data = img.pngData() {
        intent.setImage(INImage(imageData: data), forParameterNamed: \.speakableGroupName)
      }
      self?.donateIntent(intent)
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
        NSLog("[ShareIntentDonator] donateIntent failed for %@: %@", intent.conversationIdentifier ?? "?", error.localizedDescription)
      }
    }
  }
}
