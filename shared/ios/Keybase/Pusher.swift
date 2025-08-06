import Foundation
import UserNotifications
import Keybasego

class PushNotifier: NSObject, Keybasego.KeybasePushNotifierProtocol {
   func localNotification(_ ident: String?, msg: String?, badgeCount: Int, soundName: String?, convID: String?, typ: String?) {
    let content = UNMutableNotificationContent()
    if let soundName = soundName {
      content.sound = UNNotificationSound(named: UNNotificationSoundName(rawValue: soundName))
    }
    content.badge = (badgeCount >= 0) ? NSNumber(value: badgeCount) : nil
    content.body = msg ?? ""
    content.userInfo = ["convID": convID ?? "", "type": typ ?? ""]
    let request = UNNotificationRequest(identifier: ident ?? UUID().uuidString, content: content, trigger: nil)
    UNUserNotificationCenter.current().add(request) { error in
      if let error = error {
        NSLog("local notification failed: %@", error.localizedDescription)
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
    localNotification(ident, msg: msg, badgeCount: notification.badgeCount, soundName: notification.soundName, convID: notification.convID, typ: "chat.newmessage")
  }
}
