internal import Expo
import UIKit

@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
  override func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    super.scene(scene, willConnectTo: session, options: connectionOptions)

    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    if let response = connectionOptions.notificationResponse {
      appDelegate.handleNotificationResponse(response)
    }
    guard let window = self.window else { return }
    appDelegate.didStartReactNative(in: window)
  }

  override func sceneDidDisconnect(_ scene: UIScene) {
    super.sceneDidDisconnect(scene)
    (UIApplication.shared.delegate as? AppDelegate)?.didDisconnectScene()
  }
}
