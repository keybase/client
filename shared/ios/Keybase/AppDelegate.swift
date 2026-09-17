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

@main
class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider, UNUserNotificationCenterDelegate, UIDropInteractionDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  var reactNativeFactoryModuleName: String { "Keybase" }

  var resignImageView: UIImageView?
  var fsPaths: [String: String] = [:]
  private let lifecycle = AppLifecycleForwarder()
  private var locationWatcher: LocationWatcher?
  private var lastNotificationResponseKey: String?
  var iph: ItemProviderHelper?
  private var startupLogFileHandle: FileHandle?
  private let logQueue = DispatchQueue(label: "kb.startup.log", qos: .utility)

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    self.fsPaths = FsHelper().setupFs(false, setupSharedHome: true)
    FsPathsHolder.shared().fsPaths = self.fsPaths

    self.writeStartupTimingLog("didFinishLaunchingWithOptions start")

    self.didLaunchSetupBefore()

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

    self.writeStartupTimingLog("After RN init")
    self.closeStartupLogFile()

    _ = super.application(application, didFinishLaunchingWithOptions: launchOptions)

    // Start FPS monitoring if launched with -PERF_FPS_MONITOR
    PerfFPSMonitor.startIfEnabled()

    self.didLaunchSetupAfter()

    return true
  }

  // Hardware keyboard enter/shift-enter reaches the app delegate at the end of the
  // responder chain (window -> scene -> application -> delegate).
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

  /////// KB specific

  private static let logDateFormatter: DateFormatter = {
    let f = DateFormatter()
    f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
    f.timeZone = TimeZone(secondsFromGMT: 0)
    return f
  }()

  private func writeStartupTimingLog(_ message: String, file: String = #file, line: Int = #line) {
    guard let logFilePath = self.fsPaths["logFile"], !logFilePath.isEmpty else {
      return
    }

    let now = Date()
    let timeInterval = now.timeIntervalSince1970
    let microseconds = Int(timeInterval.truncatingRemainder(dividingBy: 1) * 1_000_000)
    let dateString = AppDelegate.logDateFormatter.string(from: now)
    let timestamp = String(format: "%@.%06dZ", dateString, microseconds)
    let fileName = URL(fileURLWithPath: file).lastPathComponent
    let logMessage = String(format: "%@ \u{25B6} [DEBU keybase %@:%d] Delegate startup: %@\n", timestamp, fileName, line, message)
    guard let logData = logMessage.data(using: .utf8) else {
      return
    }

    logQueue.async { [weak self] in
      guard let self else { return }
      if self.startupLogFileHandle == nil {
        // Go's logger opens this same file during KeybaseInit, so share it instead of replacing
        // it: createFile swaps in a new file by renaming, which leaves Go logging the whole
        // session to an unlinked file, and a non-append handle writes over Go's lines.
        let fd = open(logFilePath, O_WRONLY | O_CREAT | O_APPEND, 0o600)
        guard fd >= 0 else {
          NSLog("Error opening startup timing log file: \(logFilePath) errno=\(errno)")
          return
        }
        try? FileManager.default.setAttributes(
          [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
          ofItemAtPath: logFilePath
        )
        self.startupLogFileHandle = FileHandle(fileDescriptor: fd, closeOnDealloc: true)
      }
      guard let fileHandle = self.startupLogFileHandle else { return }
      do {
        try fileHandle.write(contentsOf: logData)
        try fileHandle.synchronize()
      } catch {
        NSLog("Error writing startup timing log: \(error)")
      }
    }
  }

  private func closeStartupLogFile() {
    logQueue.sync {
      if let fileHandle = self.startupLogFileHandle {
        do {
          try fileHandle.synchronize()
          try fileHandle.close()
        } catch {
          NSLog("Error closing startup timing log: \(error)")
        }
        self.startupLogFileHandle = nil
      }
    }
  }

  func setupGo() {
    // uncomment to get more console.logs
    // RCTSetLogThreshold(RCTLogLevel.info.rawValue - 1)
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
    let locationWatcher = LocationWatcher()
    self.locationWatcher = locationWatcher
    Keybasego.KeybaseInit(self.fsPaths["homedir"], self.fsPaths["sharedHome"], self.fsPaths["logFile"], "prod", securityAccessGroupOverride, nil, nil, systemVer, isIPad, nil, isIOS, shareIntentDonator, locationWatcher, &err)
    if let err {
      let initResult = "FAILED: \(err.localizedDescription) (code=\(err.code) domain=\(err.domain))"
      log.error("KeybaseInit FAILED: \(err.localizedDescription, privacy: .public)")
      self.writeStartupTimingLog("KeybaseInit \(initResult)")
      fatalError("KeybaseInit failed: \(initResult)")
    } else {
      self.writeStartupTimingLog("KeybaseInit succeeded")
    }

    self.writeStartupTimingLog("After Go init")
  }

  func didLaunchSetupBefore() {
    setupGo()
    try? AVAudioSession.sharedInstance().setCategory(.ambient)
    UNUserNotificationCenter.current().delegate = self
  }

  // BGTaskScheduler.register must run before didFinishLaunching returns, so this
  // can't wait for the scene to connect.
  func didLaunchSetupAfter() {
    BGTaskScheduler.shared.register(forTaskWithIdentifier: "com.keybase.app.refresh", using: nil) { task in
      self.handleAppRefresh(task: task as! BGAppRefreshTask)
    }
    scheduleAppRefresh()
  }

  // Called by SceneDelegate once the window exists and React Native has started in it.
  func didStartReactNative(in window: UIWindow) {
    guard let rootView = window.rootViewController?.view else { return }
    addDrop(rootView)

    rootView.backgroundColor = .systemBackground

    // Snapshot resizing workaround for iPad
    let screenBounds = window.windowScene?.screen.bounds ?? window.bounds
    var dim = screenBounds.width
    if screenBounds.height > dim {
      dim = screenBounds.height
    }
    let square = CGRect(origin: screenBounds.origin, size: CGSize(width: dim, height: dim))
    self.resignImageView?.removeFromSuperview()
    self.resignImageView = UIImageView(frame: square)
    self.resignImageView?.contentMode = .center
    self.resignImageView?.alpha = 0
    self.resignImageView?.backgroundColor = rootView.backgroundColor
    self.resignImageView?.image = UIImage(named: "LaunchImage")
    if let view = self.resignImageView { window.addSubview(view) }
  }

  // Called by SceneDelegate when the scene goes away; didStartReactNative
  // rebuilds both if a new scene connects.
  func didDisconnectScene() {
    self.window = nil
    self.resignImageView?.removeFromSuperview()
    self.resignImageView = nil
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
      let app = UIApplication.shared
      _ = self.application(app, open: url, options: [:]) || RCTLinkingManager.application(app, open: url, options: [:])
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

    // setTaskCompleted must be called exactly once, whether the sync finishes
    // or the task expires first.
    let completionQueue = DispatchQueue(label: "kb.bg.refresh.completion")
    var completed = false
    let completeOnce: (Bool) -> Void = { success in
      completionQueue.sync {
        guard !completed else { return }
        completed = true
        task.setTaskCompleted(success: success)
      }
    }

    task.expirationHandler = {
      log.warning("Background refresh task expired")
      completeOnce(false)
    }

    DispatchQueue.global(qos: .default).async {
      log.info("Background fetch started...")
      Keybasego.KeybaseBackgroundSync()
      completeOnce(true)
      log.info("Background fetch completed...")
    }
  }

  override func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    let tokenParts = deviceToken.map { data in String(format: "%02.2hhx", data) }
    let token = tokenParts.joined()
    KbSetDeviceToken(token)
  }

  override func application(_ application: UIApplication, didReceiveRemoteNotification notification: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    guard let type = notification["type"] as? String else {
      completionHandler(.noData)
      return
    }
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
        let targetUID = notification["i"] as? String ?? ""
        let pusher = PushNotifier()

        var err: NSError?
        Keybasego.KeybaseHandleBackgroundNotification(
          convID, body, "", sender, membersType, displayPlaintext, messageID, pushID, badgeCount,
          unixTime, soundName, pusher, false, targetUID, &err)
        if let err { log.error("Failed to handle in engine: \(err.localizedDescription, privacy: .public)") }
        completionHandler(.newData)
        log.info("Remote notification handle finished...")
      }
    } else {
      KbDeliverPushNotification(Self.pushPayload(notification, userInteraction: false))
      completionHandler(.newData)
    }
  }

  private static func pushPayload(_ userInfo: [AnyHashable: Any], userInteraction: Bool) -> [String: Any] {
    var payload = Dictionary(uniqueKeysWithValues: userInfo.map { (String(describing: $0.key), $0.value) })
    payload["userInteraction"] = userInteraction
    return payload
  }

  // A tap that cold-starts the app can arrive both here (via the scene's
  // connection options) and through userNotificationCenter(_:didReceive:), so
  // deliver each response once.
  func handleNotificationResponse(_ response: UNNotificationResponse) {
    let notification = response.notification
    let key = "\(notification.request.identifier)|\(notification.date.timeIntervalSince1970)"
    guard key != lastNotificationResponseKey else { return }
    lastNotificationResponseKey = key
    KbDeliverPushNotification(Self.pushPayload(notification.request.content.userInfo, userInteraction: true))
  }

  public func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
    handleNotificationResponse(response)
    completionHandler()
  }

  public func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
    KbDeliverPushNotification(Self.pushPayload(notification.request.content.userInfo, userInteraction: false))
    completionHandler([])
  }

  override func applicationWillTerminate(_ application: UIApplication) {
    self.window?.rootViewController?.view.isHidden = true
    lifecycle.willTerminate()
  }

  func hideCover() {
    log.info("hideCover: cancelling outstanding animations...")
    self.resignImageView?.layer.removeAllAnimations()
    self.resignImageView?.alpha = 0
  }

  override func applicationWillResignActive(_ application: UIApplication) {
    log.info("applicationWillResignActive: cancelling outstanding animations...")
    self.resignImageView?.layer.removeAllAnimations()
    if let view = self.resignImageView { view.superview?.bringSubviewToFront(view) }
    log.info("applicationWillResignActive: rendering keyz screen...")
    UIView.animate(withDuration: 0.3, delay: 0.1, options: .beginFromCurrentState) {
      self.resignImageView?.alpha = 1
    } completion: { finished in
      log.info("applicationWillResignActive: rendered keyz screen. Finished: \(finished)")
    }
    lifecycle.uiInactive()
  }

  override func applicationDidEnterBackground(_ application: UIApplication) {
    application.ignoreSnapshotOnNextApplicationLaunch()
    PerfFPSMonitor.appDidEnterBackground()
    log.info("applicationDidEnterBackground: cancelling outstanding animations...")
    self.resignImageView?.layer.removeAllAnimations()
    log.info("applicationDidEnterBackground: setting keyz screen alpha to 1.")
    self.resignImageView?.alpha = 1

    lifecycle.didEnterBackground(application)
  }

  override func applicationDidBecomeActive(_ application: UIApplication) {
    log.info("applicationDidBecomeActive: hiding keyz screen.")
    hideCover()
    lifecycle.didBecomeActive()
  }

  override func applicationWillEnterForeground(_ application: UIApplication) {
    log.info("applicationWillEnterForeground: hiding keyz screen.")
    PerfFPSMonitor.appWillEnterForeground()
    hideCover()
    lifecycle.uiInactive()
  }

  func applicationProtectedDataDidBecomeAvailable(_ application: UIApplication) {
    NSLog("[Startup] applicationProtectedDataDidBecomeAvailable")
  }

}

// Hands lifecycle events to Go on one serial queue, so Go sees them in callback
// order without the main thread waiting on Go (didEnterBackground queries the
// chat outbox). Also owns the UIKit background task that keeps the app alive
// while Go decides and does its background work. Main thread only.
//
// Native reports only UI state; Go derives the app state (go/libkb/lifecycle).
// Nothing here may derive state, and UIApplication.applicationState lags inside
// the scene-forwarded callbacks anyway.
final class AppLifecycleForwarder {
  // Upper bound on how long the expiration handler and willTerminate hold the
  // main thread for Go's last work (flush, a pending-message warning).
  private static let exitWorkTimeout: TimeInterval = 1

  private let queue = DispatchQueue(label: "com.keybase.app.lifecycle", qos: .userInitiated)
  private var backgroundTask: UIBackgroundTaskIdentifier = .invalid

  // willEnterForeground and willResignActive.
  func uiInactive() { queue.async { Keybasego.KeybaseAppUIInactive() } }
  func didBecomeActive() { queue.async { Keybasego.KeybaseAppUIActive() } }

  func willTerminate() {
    runBounded { Keybasego.KeybaseAppWillExit(PushNotifier()) }
  }

  // Every background entry starts its own task before asking Go, so the app
  // can't suspend mid-query, and takes over from a task an earlier entry left
  // running: that task's pending end or expiration then finds it no longer
  // current and does nothing.
  func didEnterBackground(_ application: UIApplication) {
    let owner = BackgroundTaskOwner()
    let task = application.beginBackgroundTask(withName: "kb.didEnterBackground") { [weak self] in
      self?.backgroundTaskExpired(owner.task)
    }
    owner.task = task
    let previous = backgroundTask
    backgroundTask = task
    if previous != .invalid {
      application.endBackgroundTask(previous)
    }
    queue.async {
      // A token when Go started a background task, 0 otherwise.
      let token = Keybasego.KeybaseAppUIBackground(PushNotifier())
      guard token > 0 else {
        DispatchQueue.main.async { self.endBackgroundTask(task) }
        return
      }
      DispatchQueue.global(qos: .default).async {
        Keybasego.KeybaseAppWaitBackgroundTask(token)
        DispatchQueue.main.async { self.endBackgroundTask(task) }
      }
    }
  }

  private func backgroundTaskExpired(_ task: UIBackgroundTaskIdentifier) {
    guard task != .invalid, task == backgroundTask else { return }
    log.info("background task expired")
    runBounded { Keybasego.KeybaseAppBackgroundTaskExpired(PushNotifier()) }
    endBackgroundTask(task)
  }

  private func endBackgroundTask(_ task: UIBackgroundTaskIdentifier) {
    guard task != .invalid, task == backgroundTask else { return }
    backgroundTask = .invalid
    UIApplication.shared.endBackgroundTask(task)
  }

  // Queued behind earlier events to keep the order; the wait only bounds how
  // long the app stays alive for it.
  private func runBounded(_ work: @escaping () -> Void) {
    let done = DispatchSemaphore(value: 0)
    queue.async {
      work()
      done.signal()
    }
    _ = done.wait(timeout: .now() + Self.exitWorkTimeout)
  }
}

// The expiration handler is created before beginBackgroundTask returns the id
// it needs.
private final class BackgroundTaskOwner {
  var task: UIBackgroundTaskIdentifier = .invalid
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
