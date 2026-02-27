import BackgroundTasks
internal import Expo
import React
import ReactAppDependencyProvider
import KBCommon
import UIKit
import UserNotifications
import AVFoundation
import Keybasego
import os

private let log = Logger(subsystem: "com.keybase.app", category: "delegate")

class KeyboardWindow: UIWindow {
  override func pressesBegan(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
    guard let key = presses.first?.key else {
      super.pressesBegan(presses, with: event)
      return
    }

    if key.keyCode == .keyboardReturnOrEnter {
      if key.modifierFlags.contains(.shift) {
        NotificationCenter.default.post(name: NSNotification.Name("hardwareKeyPressed"),
                                      object: nil,
                                      userInfo: ["pressedKey": "shift-enter"])
      } else {
        NotificationCenter.default.post(name: NSNotification.Name("hardwareKeyPressed"),
                                      object: nil,
                                      userInfo: ["pressedKey": "enter"])
      }
      return
    }

    super.pressesBegan(presses, with: event)
  }
}

@main
class AppDelegate: ExpoAppDelegate, UNUserNotificationCenterDelegate, UIDropInteractionDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  var resignImageView: UIImageView?
  var fsPaths: [String: String] = [:]
  var shutdownTask: UIBackgroundTaskIdentifier = .invalid
  var iph: ItemProviderHelper?
  var startupLogFileHandle: FileHandle?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    if AppDelegate.appStartTime == 0 {
      AppDelegate.appStartTime = CFAbsoluteTimeGetCurrent()
    }

    let skipLogFile = false
    self.fsPaths = FsHelper().setupFs(skipLogFile, setupSharedHome: true)
    FsPathsHolder.shared().fsPaths = self.fsPaths

    self.writeStartupTimingLog("didFinishLaunchingWithOptions start")

    self.didLaunchSetupBefore()

    if let remoteNotification = launchOptions?[.remoteNotification] as? [AnyHashable: Any] {
      let notificationDict = Dictionary(uniqueKeysWithValues: remoteNotification.map { (String(describing: $0.key), $0.value) })
      KbSetInitialNotification(notificationDict)
    }

    NotificationCenter.default.addObserver(forName: UIApplication.didReceiveMemoryWarningNotification, object: nil, queue: .main) { [weak self] notification in
      log.info("Memory warning received - deferring GC during React Native initialization")
      // see if this helps avoid this crash
      DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
        guard let self = self, self.reactNativeFactory != nil else { return }
        Keybasego.KeybaseForceGC()
      }
    }

    self.writeStartupTimingLog("Before RN init")

    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

#if os(iOS) || os(tvOS)
    let screenBounds = (UIApplication.shared.connectedScenes.first as? UIWindowScene)?.screen.bounds ?? UIScreen.main.bounds
    window = KeyboardWindow(frame: screenBounds)
    factory.startReactNative(
      withModuleName: "Keybase",
      in: window,
      launchOptions: launchOptions)
#endif

    self.writeStartupTimingLog("After RN init")
    self.closeStartupLogFile()

    _ = super.application(application, didFinishLaunchingWithOptions: launchOptions)

    // Start FPS monitoring if launched with -PERF_FPS_MONITOR
    PerfFPSMonitor.startIfEnabled()

    if let rootView = self.window?.rootViewController?.view {
      self.addDrop(rootView)
      self.didLaunchSetupAfter(application: application, rootView: rootView)
    }

    return true
  }

  // Linking API
  override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }

  /////// KB specific

  private static var appStartTime: CFAbsoluteTime = 0

  private func writeStartupTimingLog(_ message: String, file: String = #file, line: Int = #line) {
    guard let logFilePath = self.fsPaths["logFile"], !logFilePath.isEmpty else {
      return
    }

    if self.startupLogFileHandle == nil {
      if !FileManager.default.fileExists(atPath: logFilePath) {
        FileManager.default.createFile(atPath: logFilePath, contents: nil, attributes: nil)
      }

      if let fileHandle = try? FileHandle(forWritingTo: URL(fileURLWithPath: logFilePath)) {
        try? fileHandle.seekToEnd()
        self.startupLogFileHandle = fileHandle
      }
    }

    guard let fileHandle = self.startupLogFileHandle else {
      return
    }

    let now = Date()
    let timeInterval = now.timeIntervalSince1970
    let seconds = Int(timeInterval)
    let microseconds = Int((timeInterval - Double(seconds)) * 1_000_000)
    let dateFormatter = DateFormatter()
    dateFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
    dateFormatter.timeZone = TimeZone(secondsFromGMT: 0)
    let dateString = dateFormatter.string(from: now)
    let timestamp = String(format: "%@.%06dZ", dateString, microseconds)

    let fileName = URL(fileURLWithPath: file).lastPathComponent
    let logMessage = String(format: "%@ \u{25B6} [DEBU keybase %@:%d] Delegate startup: %@\n", timestamp, fileName, line, message)

    guard let logData = logMessage.data(using: .utf8) else {
      return
    }

    try? fileHandle.write(contentsOf: logData)
    try? fileHandle.synchronize()
  }

  private func closeStartupLogFile() {
    if let fileHandle = self.startupLogFileHandle {
      try? fileHandle.synchronize()
      try? fileHandle.close()
      self.startupLogFileHandle = nil
    }
  }

  func setupGo() {
    // uncomment to get more console.logs
    // RCTSetLogThreshold(RCTLogLevel.info.rawValue - 1)
    FsPathsHolder.shared().fsPaths = self.fsPaths

    let systemVer = UIDevice.current.systemVersion
    let isIPad = UIDevice.current.userInterfaceIdiom == .pad
    let isIOS = true

#if targetEnvironment(simulator)
    let securityAccessGroupOverride = true
#else
    let securityAccessGroupOverride = false
#endif

    self.writeStartupTimingLog("Before Go init")

    // Initialize Go synchronously - happens during splash screen
    log.info("Starting KeybaseInit (synchronous)...")
    var err: NSError?
    let shareIntentDonator = ShareIntentDonatorImpl()
    Keybasego.KeybaseInit(self.fsPaths["homedir"], self.fsPaths["sharedHome"], self.fsPaths["logFile"], "prod", securityAccessGroupOverride, nil, nil, systemVer, isIPad, nil, isIOS, shareIntentDonator, &err)
    if let err { log.error("KeybaseInit FAILED: \(err.localizedDescription, privacy: .public)") }

    self.writeStartupTimingLog("After Go init")
  }

  func notifyAppState(_ application: UIApplication) {
    let state = application.applicationState
    log.info("notifyAppState: notifying service with new appState: \(state.rawValue)")
    switch state {
    case .active: Keybasego.KeybaseSetAppStateForeground()
    case .background: Keybasego.KeybaseSetAppStateBackground()
    case .inactive: Keybasego.KeybaseSetAppStateInactive()
    default: Keybasego.KeybaseSetAppStateForeground()
    }
  }

  func didLaunchSetupBefore() {
    setupGo()
    try? AVAudioSession.sharedInstance().setCategory(.ambient)
    UNUserNotificationCenter.current().delegate = self
  }

  func didLaunchSetupAfter(application: UIApplication, rootView: UIView) {
    notifyAppState(application)

    rootView.backgroundColor = .systemBackground

    // Snapshot resizing workaround for iPad
    let screenBounds = self.window?.windowScene?.screen.bounds ?? UIScreen.main.bounds
    var dim = screenBounds.width
    if screenBounds.height > dim {
      dim = screenBounds.height
    }
    let square = CGRect(origin: screenBounds.origin, size: CGSize(width: dim, height: dim))
    self.resignImageView = UIImageView(frame: square)
    self.resignImageView?.contentMode = .center
    self.resignImageView?.alpha = 0
    self.resignImageView?.backgroundColor = rootView.backgroundColor
    self.resignImageView?.image = UIImage(named: "LaunchImage")
    self.window?.addSubview(self.resignImageView!)

    BGTaskScheduler.shared.register(forTaskWithIdentifier: "com.keybase.app.refresh", using: nil) { task in
      self.handleAppRefresh(task: task as! BGAppRefreshTask)
    }
    scheduleAppRefresh()
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

  func scheduleAppRefresh() {
    let request = BGAppRefreshTaskRequest(identifier: "com.keybase.app.refresh")
    request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
    do {
      try BGTaskScheduler.shared.submit(request)
    } catch {
      log.error("Could not schedule app refresh: \(error.localizedDescription, privacy: .public)")
    }
  }

  func handleAppRefresh(task: BGAppRefreshTask) {
    scheduleAppRefresh()

    task.expirationHandler = {
      log.warning("Background refresh task expired")
    }

    DispatchQueue.global(qos: .default).async {
      log.info("Background fetch started...")
      Keybasego.KeybaseBackgroundSync()
      task.setTaskCompleted(success: true)
      log.info("Background fetch completed...")
    }
  }

  override func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    let tokenParts = deviceToken.map { data in String(format: "%02.2hhx", data) }
    let token = tokenParts.joined()
    KbSetDeviceToken(token)
  }

  override func application(_ application: UIApplication, didReceiveRemoteNotification notification: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
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
        if let err { log.error("Failed to handle in engine: \(err.localizedDescription, privacy: .public)") }
        completionHandler(.newData)
        log.info("Remote notification handle finished...")
      }
    } else {
      var notificationDict = Dictionary(uniqueKeysWithValues: notification.map { (String(describing: $0.key), $0.value) })
      notificationDict["userInteraction"] = false
      KbEmitPushNotification(notificationDict)
      completionHandler(.newData)
    }
  }

  public func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
    let userInfo = response.notification.request.content.userInfo
    var notificationDict = Dictionary(uniqueKeysWithValues: userInfo.map { (String(describing: $0.key), $0.value) })
    notificationDict["userInteraction"] = true

    // Store the notification so it can be processed when app becomes active
    // This ensures navigation works even if React Native isn't ready yet
    KbSetInitialNotification(notificationDict)

    // Also emit immediately in case React Native is ready
    KbEmitPushNotification(notificationDict)
    completionHandler()
  }

  public func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
    let userInfo = notification.request.content.userInfo
    var notificationDict = Dictionary(uniqueKeysWithValues: userInfo.map { (String(describing: $0.key), $0.value) })
    notificationDict["userInteraction"] = false
    KbEmitPushNotification(notificationDict)
    completionHandler([])
  }

  override func applicationWillTerminate(_ application: UIApplication) {
    self.window?.rootViewController?.view.isHidden = true
    Keybasego.KeybaseAppWillExit(PushNotifier())
  }

  func hideCover() {
    log.info("hideCover: cancelling outstanding animations...")
    self.resignImageView?.layer.removeAllAnimations()
    self.resignImageView?.alpha = 0
  }

  override func applicationWillResignActive(_ application: UIApplication) {
    log.info("applicationWillResignActive: cancelling outstanding animations...")
    self.resignImageView?.layer.removeAllAnimations()
    self.resignImageView?.superview?.bringSubviewToFront(self.resignImageView!)
    log.info("applicationWillResignActive: rendering keyz screen...")
    UIView.animate(withDuration: 0.3, delay: 0.1, options: .beginFromCurrentState) {
      self.resignImageView?.alpha = 1
    } completion: { finished in
      log.info("applicationWillResignActive: rendered keyz screen. Finished: \(finished)")
    }
    Keybasego.KeybaseSetAppStateInactive()
  }

  override func applicationDidEnterBackground(_ application: UIApplication) {
    PerfFPSMonitor.appDidEnterBackground()
    log.info("applicationDidEnterBackground: cancelling outstanding animations...")
    self.resignImageView?.layer.removeAllAnimations()
    log.info("applicationDidEnterBackground: setting keyz screen alpha to 1.")
    self.resignImageView?.alpha = 1

    log.info("applicationDidEnterBackground: notifying go.")
    let requestTime = Keybasego.KeybaseAppDidEnterBackground()
    log.info("applicationDidEnterBackground: after notifying go.")

    if requestTime && (self.shutdownTask == UIBackgroundTaskIdentifier.invalid) {
      let app = UIApplication.shared
      self.shutdownTask = app.beginBackgroundTask {
        log.info("applicationDidEnterBackground: shutdown task run.")
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

  override func applicationDidBecomeActive(_ application: UIApplication) {
    log.info("applicationDidBecomeActive: hiding keyz screen.")
    hideCover()
    log.info("applicationDidBecomeActive: notifying service.")
    notifyAppState(application)

    // Check if there's a stored notification with userInteraction that needs to be processed
    // This handles the case where app was backgrounded and notification was clicked
    // but React Native wasn't ready yet
    if let storedNotification = KbGetAndClearInitialNotification() {
      let userInteraction = storedNotification["userInteraction"] as? Bool ?? false

      if userInteraction {
        let alreadyReEmitted = (storedNotification["reEmittedInBecomeActive"] as? Bool) == true
        if alreadyReEmitted {
          KbSetInitialNotification(storedNotification)
        } else {
          log.info("applicationDidBecomeActive: stored notification has userInteraction=true, emitting")
          KbEmitPushNotification(storedNotification)
          var copy = storedNotification
          copy["reEmittedInBecomeActive"] = true
          KbSetInitialNotification(copy)
        }
      } else {
        log.info("applicationDidBecomeActive: stored notification has userInteraction=false, skipping")
      }
    } else {
      log.info("applicationDidBecomeActive: no stored notification found")
    }
  }

  override func applicationWillEnterForeground(_ application: UIApplication) {
    log.info("applicationWillEnterForeground: hiding keyz screen.")
    hideCover()
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
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
