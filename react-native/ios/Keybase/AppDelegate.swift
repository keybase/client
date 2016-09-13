import UIKit

func appDelegate() -> AppDelegate {
  return UIApplication.shared.delegate as! AppDelegate
}

@UIApplicationMain
@objc(AppDelegate)
class AppDelegate: UIResponder {

  var window: UIWindow?
#if TESTING
#else
  var engine: Engine!
  var logSender: LogSend!
#endif

  fileprivate func setupReactWithOptions(_ launchOptions: [AnyHashable: Any]?) -> RCTRootView {
    return RCTRootView(bundleURL: {

      #if DEBUG
        if let reactHost = AppDefault.ReactHost.stringValue {
          return NSURL(string: "http://\(reactHost)/index.ios.bundle?platform=ios&dev=true") as URL!
        } else {
          return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
        }
      #else
        return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
      #endif
    }(), moduleName: "Keybase", initialProperties: nil, launchOptions: launchOptions)
  }

  fileprivate func setupEngine() {
    #if SIMULATOR
      let SecurityAccessGroupOverride = true
    #else
      let SecurityAccessGroupOverride = false
    #endif

    var home = AppDefault.HomeDirectory.stringValue ?? ""
    if home == "" {
      home = NSHomeDirectory()
    } else {
      let root = (NSHomeDirectory() as NSString).appendingPathComponent("Library")
      home = (root as NSString).appendingPathComponent(home)
    }

#if TESTING
#else
    let logFile = (home as NSString).appendingPathComponent("ios.log");

    engine = try! Engine(settings: [
      "runmode": AppDefault.RunMode.stringValue!,
      "homedir": home,
      "logFile": logFile,
      "serverURI": AppDefault.APIServer.stringValue ?? "",
      "SecurityAccessGroupOverride": SecurityAccessGroupOverride
    ])

    logSender = LogSend(path: logFile);
#endif
  }

}

class KeyListener: UIViewController {
  override var canBecomeFirstResponder : Bool {
    return true
  }

  var bridge: RCTBridge!

  override var keyCommands: [UIKeyCommand]? {
    return [
      UIKeyCommand(input: "[", modifierFlags: .command, action: #selector(KeyListener.goBackInTime(_:))),
      UIKeyCommand(input: "]", modifierFlags: .command, action: #selector(KeyListener.goForwardInTime(_:))),
      UIKeyCommand(input: "s", modifierFlags: [.shift, .command], action: #selector(KeyListener.saveState(_:))),
      UIKeyCommand(input: "c", modifierFlags: [.shift, .command], action: #selector(KeyListener.clearState(_:)))
    ]
  }

  func goBackInTime(_ sender: UIKeyCommand){
    bridge.eventDispatcher().sendDeviceEvent(withName: "backInTime", body: true)
  }

  func goForwardInTime(_ sender: UIKeyCommand){
    bridge.eventDispatcher().sendDeviceEvent(withName: "forwardInTime", body: true)
  }

  func saveState(_ sender: UIKeyCommand){
    bridge.eventDispatcher().sendDeviceEvent(withName: "saveState", body: true)
  }

  func clearState(_ sender: UIKeyCommand){
    bridge.eventDispatcher().sendDeviceEvent(withName: "clearState", body: true)
  }

}

extension AppDelegate: UIApplicationDelegate {

  func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplicationLaunchOptionsKey: Any]?) -> Bool {
    AppDefault.RunMode.setDefaultValue("staging" as AnyObject)

    #if SIMULATOR
      AppDefault.ReactHost.setDefaultValue("localhost:8081" as AnyObject)
    #else
      #if DEBUG
        // Uncomment if you want your device to hit a local server while debugging
//        AppDefault.ReactHost.setDefaultValue("192.168.1.50:8081")
//        AppDefault.APIServer.setDefaultValue("http://192.168.1.50:3000")
      #endif
    #endif

    setupEngine()

    let rootViewController = KeyListener()
    let rctView = setupReactWithOptions(launchOptions)
    rootViewController.view = rctView
    rootViewController.bridge = rctView.bridge

    let window = UIWindow(frame: UIScreen.main.bounds)
    self.window = window
    window.rootViewController = rootViewController
    window.makeKeyAndVisible()
    return true
  }

}
