internal import Expo
import UIKit

class SceneDelegate: ExpoAppSceneDelegate {
  override func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    super.scene(scene, willConnectTo: session, options: connectionOptions)

    guard let windowScene = scene as? UIWindowScene,
      let expoWindow = self.window,
      let rootViewController = expoWindow.rootViewController,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate
    else { return }

    // ExpoAppSceneDelegate always creates a plain UIWindow, but hardware enter /
    // shift-enter in the chat input needs KeyboardWindow. Move React Native's root
    // view controller over before anything has rendered.
    expoWindow.rootViewController = nil
    expoWindow.isHidden = true
    let window = KeyboardWindow(windowScene: windowScene)
    window.rootViewController = rootViewController
    window.makeKeyAndVisible()
    self.window = window
    appDelegate.window = window

    appDelegate.didStartReactNative(in: window)
  }
}
