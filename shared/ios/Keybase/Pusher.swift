import Foundation
import Keybasego
import UserNotifications

class PushNotifier: NSObject, Keybasego.KeybasePushNotifierProtocol {
  func localNotification(
    _ ident: String?, title: String?, msg: String?, badgeCount: Int, soundName: String?,
    convID: String?, typ: String?
  ) {
    let content = UNMutableNotificationContent()
    if let soundName = soundName {
      content.sound = UNNotificationSound(named: UNNotificationSoundName(rawValue: soundName))
    }
    if badgeCount >= 0 {
      content.badge = NSNumber(value: badgeCount)
      // Keep the persisted active-account badge in sync so AppDelegate can
      // restore it when a loud push for a different account temporarily sets
      // the wrong system badge (see didReceiveRemoteNotification).
      UserDefaults.standard.set(badgeCount, forKey: "KeybaseActiveBadge")
      NSLog("PushNotifier localNotification: persisting KeybaseActiveBadge=%d", badgeCount)
    }
    content.title = title ?? ""
    content.body = msg ?? ""
    content.userInfo = ["convID": convID ?? "", "type": typ ?? ""]
    let request = UNNotificationRequest(
      identifier: ident ?? UUID().uuidString, content: content, trigger: nil)
    UNUserNotificationCenter.current().add(request) { error in
      if let error = error {
        NSLog("local notification failed: %@", error.localizedDescription)
      }
    }
  }

  func display(_ n: KeybaseChatNotification?) {
    guard let notification = n, let message = notification.message else { return }

    let ident = "\(notification.convID):\(message.id_)"
    let msg: String
    if notification.isPlaintext && !message.plaintext.isEmpty {
      let username = message.from?.keybaseUsername ?? ""
      let convName = notification.conversationName
      msg =
        (username == convName || convName.isEmpty)
        ? "\(username): \(message.plaintext)"
        : "\(username) (\(convName)): \(message.plaintext)"
    } else {
      msg = message.serverMessage
    }
    let title = notification.title
    NSLog("PushNotifier display: title=%@", title ?? "")
    localNotification(
      ident, title: title, msg: msg, badgeCount: notification.badgeCount,
      soundName: notification.soundName, convID: notification.convID, typ: "chat.newmessage")
  }
}
