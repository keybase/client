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

    guard let window = self.window,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate
    else { return }
    appDelegate.didStartReactNative(in: window)
  }

  override func sceneDidDisconnect(_ scene: UIScene) {
    super.sceneDidDisconnect(scene)
    (UIApplication.shared.delegate as? AppDelegate)?.didDisconnectScene()
  }
}
