import Foundation
import UserNotifications
import Keybasego
import os

private let log = Logger(subsystem: "com.keybase.app", category: "push")

// Serial so notifications post in the order Go scheduled them.
private let pushQueue = DispatchQueue(label: "com.keybase.app.push", qos: .userInitiated)

class PushNotifier: NSObject, Keybasego.KeybasePushNotifierProtocol {
  func localNotification(
    _ ident: String?, title: String?, msg: String?, badgeCount: Int, soundName: String?,
    convID: String?, typ: String?, uid: String?
  ) {
    // Invoked by Go over the gomobile cgo bridge, so this runs on a Go-runtime-managed thread,
    // not a real NSThread/dispatch queue. Hop to a GCD queue before touching UserNotifications.
    pushQueue.async {
      let content = UNMutableNotificationContent()
      if let soundName = soundName {
        content.sound = UNNotificationSound(named: UNNotificationSoundName(rawValue: soundName))
      }
      content.badge = (badgeCount >= 0) ? NSNumber(value: badgeCount) : nil
      content.title = title ?? ""
      content.body = msg ?? ""
      content.userInfo = ["convID": convID ?? "", "type": typ ?? "", "uid": uid ?? ""]
      let request = UNNotificationRequest(
        identifier: ident ?? UUID().uuidString, content: content, trigger: nil)
      UNUserNotificationCenter.current().add(request) { error in
        if let error = error {
          log.error("local notification failed: \(error.localizedDescription, privacy: .public)")
        }
      }
    }
  }

  // If we lost the race against the server's fallback timeout, the generic
  // "you have a new message" push for this message is already in Notification
  // Center. The local plaintext notification supersedes it, so remove it.
  private func removeDeliveredGenericNotification(convID: String, msgID: Int) {
    let center = UNUserNotificationCenter.current()
    center.getDeliveredNotifications { delivered in
      let ids = delivered.filter { note in
        let info = note.request.content.userInfo
        guard let type = info["type"] as? String, type == "chat.newmessage" else { return false }
        guard let c = info["convID"] as? String, c == convID else { return false }
        let m = (info["msgID"] as? NSNumber)?.intValue ?? Int(info["msgID"] as? String ?? "")
        return m == msgID
      }.map { $0.request.identifier }
      if !ids.isEmpty {
        center.removeDeliveredNotifications(withIdentifiers: ids)
      }
    }
  }

  func display(_ n: KeybaseChatNotification?) {
    guard let notification = n else { return }
    guard let message = notification.message else { return }

    let ident = "\(notification.convID):\(message.id_)"
    let msg: String
    if notification.isPlaintext && !message.plaintext.isEmpty {
      let username = message.from?.keybaseUsername ?? ""
      let convName = notification.conversationName
      msg = (username == convName || convName.isEmpty)
        ? "\(username): \(message.plaintext)"
        : "\(username) (\(convName)): \(message.plaintext)"
    } else {
      msg = message.serverMessage
    }
    let title = notification.title

    let soundName: String? = notification.soundName.isEmpty ? nil : notification.soundName
    let uid: String? = notification.uid.isEmpty ? nil : notification.uid
    localNotification(
      ident, title: title, msg: msg,
      badgeCount: notification.badgeCount,
      soundName: soundName,
      convID: notification.convID,
      typ: "chat.newmessage",
      uid: uid
    )
    removeDeliveredGenericNotification(convID: notification.convID, msgID: Int(message.id_))
  }
}
