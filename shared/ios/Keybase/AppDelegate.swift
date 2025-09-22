import Expo
import React
import ReactAppDependencyProvider
import KBCommon
import UIKit
import UserNotifications
import AVFoundation
import RNCPushNotificationIOS
import ExpoModulesCore
import Keybasego

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate, UNUserNotificationCenterDelegate, UIDropInteractionDelegate {
  var window: UIWindow?
  
  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  
  var resignImageView: UIImageView?
  var fsPaths: [String: String] = [:]
  var shutdownTask: UIBackgroundTaskIdentifier = .invalid
  var iph: ItemProviderHelper?
  var hwKeyEvent: RNHWKeyboardEvent?
  
  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    self.didLaunchSetupBefore()
    
    NotificationCenter.default.addObserver(forName: UIApplication.didReceiveMemoryWarningNotification, object: nil, queue: .main) { notification in
      NSLog("Memory warning received - deferring GC during React Native initialization")
      // see if this helps avoid this crash
      DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
        if self.reactNativeFactory != nil {
          Keybasego.KeybaseForceGC()
        }
      }
    }
    
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()
    
    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)
    
#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "Keybase",
      in: window,
      launchOptions: launchOptions)
#endif
    
    _ = super.application(application, didFinishLaunchingWithOptions: launchOptions)
    
    if let rootView = self.window?.rootViewController?.view {
      self.addDrop(rootView)
      self.didLaunchSetupAfter(application: application, rootView: rootView)
    }
    
    return true
  }
  
  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }
  
  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
  
  /////// KB specific
  
  func setupGo() {
    // set to true to see logs in xcode
    let skipLogFile = false
    // uncomment to get more console.logs
    // RCTSetLogThreshold(RCTLogLevel.info.rawValue - 1)
    self.fsPaths = FsHelper().setupFs(skipLogFile, setupSharedHome: true)
    FsPathsHolder.shared().fsPaths = self.fsPaths
    
    
    let systemVer = UIDevice.current.systemVersion
    let isIPad = UIDevice.current.userInterfaceIdiom == .pad
    let isIOS = true
    
#if targetEnvironment(simulator)
    let securityAccessGroupOverride = true
#else
    let securityAccessGroupOverride = false
#endif
    
    var err: NSError?
    Keybasego.KeybaseInit(fsPaths["homedir"], fsPaths["sharedHome"], fsPaths["logFile"], "prod", securityAccessGroupOverride, nil, nil, systemVer, isIPad, nil, isIOS, &err)
    if let err { NSLog("KeybaseInit fail?: \(err)") }
  }
  
  func notifyAppState(_ application: UIApplication) {
    let state = application.applicationState
    NSLog("notifyAppState: notifying service with new appState: \(state.rawValue)")
    switch state {
    case .active: Keybasego.KeybaseSetAppStateForeground()
    case .background: Keybasego.KeybaseSetAppStateBackground()
    case .inactive: Keybasego.KeybaseSetAppStateInactive()
    default: Keybasego.KeybaseSetAppStateForeground()
    }
  }
  
  func didLaunchSetupBefore() {
    try? AVAudioSession.sharedInstance().setCategory(.ambient)
    UNUserNotificationCenter.current().delegate = self
  }
  
  func didLaunchSetupAfter(application: UIApplication, rootView: UIView) {
    setupGo()
    notifyAppState(application)
    
    rootView.backgroundColor = .systemBackground
    
    // Snapshot resizing workaround for iPad
    var dim = UIScreen.main.bounds.width
    if UIScreen.main.bounds.height > dim {
      dim = UIScreen.main.bounds.height
    }
    let square = CGRect(origin: UIScreen.main.bounds.origin, size: CGSize(width: dim, height: dim))
    self.resignImageView = UIImageView(frame: square)
    self.resignImageView?.contentMode = .center
    self.resignImageView?.alpha = 0
    self.resignImageView?.backgroundColor = rootView.backgroundColor
    self.resignImageView?.image = UIImage(named: "LaunchImage")
    self.window?.addSubview(self.resignImageView!)
    
    UIApplication.shared.setMinimumBackgroundFetchInterval(UIApplication.backgroundFetchIntervalMinimum)
  }
  
  func addDrop(_ rootView: UIView) {
    let dropInteraction = UIDropInteraction(delegate: self)
    dropInteraction.allowsSimultaneousDropSessions = true
    rootView.addInteraction(dropInteraction)
  }
  
  public func dropInteraction(_ interaction: UIDropInteraction, canHandle session: UIDropSession) -> Bool {
    return true
  }
  
  public func dropInteraction(_ interaction: UIDropInteraction, sessionDidUpdate session: UIDropSession) -> UIDropProposal {
    return UIDropProposal(operation: .copy)
  }
  
  public func dropInteraction(_ interaction: UIDropInteraction, performDrop session: UIDropSession) {
    var items: [NSItemProvider] = []
    session.items.forEach { item in items.append(item.itemProvider) }
    
    self.iph = ItemProviderHelper(forShare: false, withItems: [items]) { [weak self] in
      guard let self else { return }
      let url = URL(string: "keybase://incoming-share")!
      _ = self.application(UIApplication.shared, open: url, options: [:])
      self.iph = nil
    }
    self.iph?.startProcessing()
  }
  
  public override func application(_ application: UIApplication, performFetchWithCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    NSLog("Background fetch started...")
    DispatchQueue.global(qos: .default).async {
      Keybasego.KeybaseBackgroundSync()
      completionHandler(.newData)
      NSLog("Background fetch completed...")
    }
  }
  
  public override func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    RNCPushNotificationIOS.didRegisterForRemoteNotifications(withDeviceToken: deviceToken)
  }
  
  public override func application(_ application: UIApplication, didReceiveRemoteNotification notification: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    guard let type = notification["type"] as? String else { return }
    if type == "chat.newmessageSilent_2" {
      DispatchQueue.global(qos: .default).async {
        let convID = notification["c"] as? String
        let messageID = (notification["d"] as? NSNumber)?.intValue ?? 0
        let pushID = (notification["p"] as? [String])?.first
        let body = notification["m"] as? String ?? ""
        let badgeCount = (notification["b"] as? NSNumber)?.intValue ?? 0
        let unixTime = (notification["x"] as? NSNumber)?.intValue ?? 0
        let soundName = notification["s"] as? String
        let displayPlaintext = (notification["n"] as? NSNumber)?.boolValue ?? false
        let membersType = (notification["t"] as? NSNumber)?.intValue ?? 0
        let sender = notification["u"] as? String
        let pusher = PushNotifier()
        
        var err: NSError?
        Keybasego.KeybaseHandleBackgroundNotification(convID, body, "", sender, membersType, displayPlaintext, messageID, pushID, badgeCount, unixTime, soundName, pusher, false, &err)
        if let err { NSLog("Failed to handle in engine: \(err)") }
        completionHandler(.newData)
        NSLog("Remote notification handle finished...")
      }
    } else {
      RNCPushNotificationIOS.didReceiveRemoteNotification(notification)
      completionHandler(.newData)
    }
  }
  
  public override func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    RNCPushNotificationIOS.didFailToRegisterForRemoteNotificationsWithError(error)
  }
  
  public func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
    RNCPushNotificationIOS.didReceive(response)
  }
  
  public override func applicationWillTerminate(_ application: UIApplication) {
    self.window?.rootViewController?.view.isHidden = true
    Keybasego.KeybaseAppWillExit(PushNotifier())
  }
  
  func hideCover() {
    NSLog("hideCover: cancelling outstanding animations...")
    self.resignImageView?.layer.removeAllAnimations()
    self.resignImageView?.alpha = 0
  }
  
  public override func applicationWillResignActive(_ application: UIApplication) {
    NSLog("applicationWillResignActive: cancelling outstanding animations...")
    self.resignImageView?.layer.removeAllAnimations()
    self.resignImageView?.superview?.bringSubviewToFront(self.resignImageView!)
    NSLog("applicationWillResignActive: rendering keyz screen...")
    UIView.animate(withDuration: 0.3, delay: 0.1, options: .beginFromCurrentState) {
      self.resignImageView?.alpha = 1
    } completion: { finished in
      NSLog("applicationWillResignActive: rendered keyz screen. Finished: \(finished)")
    }
    Keybasego.KeybaseSetAppStateInactive()
  }
  
  public override func applicationDidEnterBackground(_ application: UIApplication) {
    application.ignoreSnapshotOnNextApplicationLaunch()
    NSLog("applicationDidEnterBackground: cancelling outstanding animations...")
    self.resignImageView?.layer.removeAllAnimations()
    NSLog("applicationDidEnterBackground: setting keyz screen alpha to 1.")
    self.resignImageView?.alpha = 1
    
    NSLog("applicationDidEnterBackground: notifying go.")
    let requestTime = Keybasego.KeybaseAppDidEnterBackground()
    NSLog("applicationDidEnterBackground: after notifying go.")
    
    if requestTime && (self.shutdownTask == UIBackgroundTaskIdentifier.invalid) {
      let app = UIApplication.shared
      self.shutdownTask = app.beginBackgroundTask {
        NSLog("applicationDidEnterBackground: shutdown task run.")
        Keybasego.KeybaseAppWillExit(PushNotifier())
        let task = self.shutdownTask
        if task != .invalid {
          app.endBackgroundTask(task)
          self.shutdownTask = .invalid
        }
      }
      
      DispatchQueue.global(qos: .default).async {
        Keybasego.KeybaseAppBeginBackgroundTask(PushNotifier())
        let task = self.shutdownTask
        if task != .invalid {
          app.endBackgroundTask(task)
          self.shutdownTask = .invalid
        }
      }
    }
  }
  
  public override func applicationDidBecomeActive(_ application: UIApplication) {
    NSLog("applicationDidBecomeActive: hiding keyz screen.")
    hideCover()
    NSLog("applicationDidBecomeActive: notifying service.")
    notifyAppState(application)
  }
  
  public override func applicationWillEnterForeground(_ application: UIApplication) {
    NSLog("applicationWillEnterForeground: hiding keyz screen.")
    hideCover()
  }
  
  func keyCommands() -> [UIKeyCommand]? {
    var keys = [UIKeyCommand]()
    if hwKeyEvent == nil {
      hwKeyEvent = RNHWKeyboardEvent()
    }
    if hwKeyEvent?.isListening() == true {
      keys.append(UIKeyCommand(input: "\r", modifierFlags: [], action: #selector(sendEnter(_:))))
      keys.append(UIKeyCommand(input: "\r", modifierFlags: .shift, action: #selector(sendShiftEnter(_:))))
    }
    return keys
  }
  
  @objc func sendEnter(_ sender: UIKeyCommand) {
    (hwKeyEvent)?.sendHWKeyEvent("enter")
  }
  
  @objc func sendShiftEnter(_ sender: UIKeyCommand) {
    (hwKeyEvent)?.sendHWKeyEvent("shift-enter")
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins
  
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }
  
  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
