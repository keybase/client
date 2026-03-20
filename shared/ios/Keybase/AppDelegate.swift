import Expo
import React
import ReactAppDependencyProvider
import KBCommon
import UIKit
import UserNotifications
import AVFoundation
import ExpoModulesCore
import Keybasego
import Darwin

// File-scope globals for signal-based main thread stack capture.
// Must be trivial C types — signal handlers cannot safely use Swift objects.
private let kMaxStackFrames: Int32 = 128
private var gMainStackFrames = [UnsafeMutableRawPointer?](repeating: nil, count: Int(kMaxStackFrames))
private var gMainStackFrameCount: Int32 = 0
private var gMainStackReady: Bool = false
// Captured in didFinishLaunchingWithOptions (which runs on main); used by the watchdog
// to send SIGUSR1 to the main thread. pthread_main_thread_np() is not exposed in Swift.
private var gMainThreadPthread: pthread_t? = nil

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

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate, UNUserNotificationCenterDelegate, UIDropInteractionDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  var resignImageView: UIImageView?
  var fsPaths: [String: String] = [:]
  var shutdownTask: UIBackgroundTaskIdentifier = .invalid
  var iph: ItemProviderHelper?
  var startupLogFileHandle: FileHandle?

  // Main thread watchdog
  private var watchdogActive = false
  private let watchdogLock = NSLock()
  private var watchdogLastPong: CFAbsoluteTime = 0
  private var watchdogBgEnterTime: CFAbsoluteTime = 0

  public override func application(
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
    gMainThreadPthread = pthread_self()
    AppDelegate.installMainThreadStackCaptureHandler()
    self.startMainThreadWatchdog(context: "cold start")

    self.didLaunchSetupBefore()

    if let remoteNotification = launchOptions?[.remoteNotification] as? [AnyHashable: Any] {
      let notificationDict = Dictionary(uniqueKeysWithValues: remoteNotification.map { (String(describing: $0.key), $0.value) })
      KbSetInitialNotification(notificationDict)
    }

    NotificationCenter.default.addObserver(forName: UIApplication.didReceiveMemoryWarningNotification, object: nil, queue: .main) { [weak self] notification in
      NSLog("Memory warning received - deferring GC during React Native initialization")
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
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = KeyboardWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "Keybase",
      in: window,
      launchOptions: launchOptions)
#endif

    self.writeStartupTimingLog("After RN init")
    self.closeStartupLogFile()

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

  private static var appStartTime: CFAbsoluteTime = 0

  private func writeStartupTimingLog(_ message: String, file: String = #file, line: Int = #line) {
    guard let logFilePath = self.fsPaths["logFile"], !logFilePath.isEmpty else {
      return
    }

    if self.startupLogFileHandle == nil {
      do {
        if !FileManager.default.fileExists(atPath: logFilePath) {
          FileManager.default.createFile(atPath: logFilePath, contents: nil, attributes: nil)
        }

        if let fileHandle = FileHandle(forWritingAtPath: logFilePath) {
          fileHandle.seekToEndOfFile()
          self.startupLogFileHandle = fileHandle
        }
      } catch {
        NSLog("Error opening startup timing log file: \(error)")
        return
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

    let fileName = (file as NSString).lastPathComponent
    let logMessage = String(format: "%@ ▶ [DEBU keybase %@:%d] Delegate startup: %@\n", timestamp, fileName, line, message)

    guard let logData = logMessage.data(using: .utf8) else {
      return
    }

    do {
      fileHandle.write(logData)
      fileHandle.synchronizeFile()
    } catch {
      NSLog("Error writing startup timing log: \(error)")
    }
  }

  private func closeStartupLogFile() {
    if let fileHandle = self.startupLogFileHandle {
      fileHandle.synchronizeFile()
      fileHandle.closeFile()
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
    NSLog("Starting KeybaseInit (synchronous)...")
    var err: NSError?
    let shareIntentDonator = ShareIntentDonatorImpl()
    Keybasego.KeybaseInit(self.fsPaths["homedir"], self.fsPaths["sharedHome"], self.fsPaths["logFile"], "prod", securityAccessGroupOverride, nil, nil, systemVer, isIPad, nil, isIOS, shareIntentDonator, &err)
    if let err { NSLog("KeybaseInit FAILED: \(err)") }

    self.writeStartupTimingLog("After Go init")
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
    NSLog("notifyAppState: done")
    Keybasego.KeybaseFlushLogs()
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
    let fetchStart = CFAbsoluteTimeGetCurrent()
    NSLog("Background fetch queued...")
    DispatchQueue.global(qos: .default).async {
      NSLog("Background fetch started...")
      let status = Keybasego.KeybaseBackgroundSync()
      let elapsed = (CFAbsoluteTimeGetCurrent() - fetchStart) * 1000
      if status.isEmpty {
        NSLog("Background fetch completed in %.0fms", elapsed)
      } else {
        NSLog("Background fetch completed in %.0fms: %@", elapsed, status)
      }
      completionHandler(.newData)
    }
  }

  public override func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    let tokenParts = deviceToken.map { data in String(format: "%02.2hhx", data) }
    let token = tokenParts.joined()
    KbSetDeviceToken(token)
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

    let type = notificationDict["type"] as? String ?? "unknown"
    let convID = notificationDict["convID"] as? String ?? notificationDict["c"] as? String ?? "unknown"

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
    startMainThreadWatchdog(context: "background entered")
    application.ignoreSnapshotOnNextApplicationLaunch()
    NSLog("applicationDidEnterBackground: cancelling outstanding animations...")
    self.resignImageView?.layer.removeAllAnimations()
    NSLog("applicationDidEnterBackground: setting keyz screen alpha to 1.")
    self.resignImageView?.alpha = 1

    NSLog("applicationDidEnterBackground: notifying go.")
    let requestTime = Keybasego.KeybaseAppDidEnterBackground()
    NSLog("applicationDidEnterBackground: after notifying go.")
    Keybasego.KeybaseFlushLogs()

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
    stopMainThreadWatchdog()
    Keybasego.KeybaseFlushLogs()
    let elapsed = CFAbsoluteTimeGetCurrent() - AppDelegate.appStartTime
    writeStartupTimingLog(String(format: "applicationDidBecomeActive: %.1fms after launch", elapsed * 1000))
    NSLog("applicationDidBecomeActive: hiding keyz screen.")
    hideCover()
    NSLog("applicationDidBecomeActive: notifying service.")
    notifyAppState(application)

    // Check if there's a stored notification with userInteraction that needs to be processed
    // This handles the case where app was backgrounded and notification was clicked
    // but React Native wasn't ready yet
    if let storedNotification = KbGetAndClearInitialNotification() {
      let type = storedNotification["type"] as? String ?? "unknown"
      let convID = storedNotification["convID"] as? String ?? storedNotification["c"] as? String ?? "unknown"
      let userInteraction = storedNotification["userInteraction"] as? Bool ?? false

      if userInteraction {
        let alreadyReEmitted = (storedNotification["reEmittedInBecomeActive"] as? Bool) == true
        if alreadyReEmitted {
          KbSetInitialNotification(storedNotification)
        } else {
          NSLog("applicationDidBecomeActive: stored notification has userInteraction=true, emitting")
          KbEmitPushNotification(storedNotification)
          var copy = Dictionary(uniqueKeysWithValues: storedNotification.map { (String(describing: $0.key), $0.value) })
          copy["reEmittedInBecomeActive"] = true
          KbSetInitialNotification(copy as NSDictionary as! [AnyHashable : Any])
        }
      } else {
        NSLog("applicationDidBecomeActive: stored notification has userInteraction=false, skipping")
      }
    } else {
      NSLog("applicationDidBecomeActive: no stored notification found")
    }
  }

  public override func applicationWillEnterForeground(_ application: UIApplication) {
    NSLog("applicationWillEnterForeground: hiding keyz screen.")
    hideCover()
  }

  // Register a SIGUSR1 handler that captures the main thread's own stack via backtrace().
  // backtrace() is async-signal-safe on Darwin; must be called once before any hang can occur.
  private static func installMainThreadStackCaptureHandler() {
    signal(SIGUSR1) { _ in
      gMainStackFrameCount = backtrace(&gMainStackFrames, kMaxStackFrames)
      gMainStackReady = true
    }
  }

  // Send SIGUSR1 to the main thread, wait briefly for the handler to run, then log the stack.
  // Called from the watchdog background thread on first hang detection.
  private func logMainThreadStackTrace() {
    gMainStackReady = false
    guard let mainThread = gMainThreadPthread else {
      NSLog("[Startup] Watchdog: main thread pthread not captured")
      return
    }
    pthread_kill(mainThread, SIGUSR1)
    // Spin up to 200ms for the signal handler to complete
    for _ in 0..<20 {
      if gMainStackReady { break }
      Thread.sleep(forTimeInterval: 0.01)
    }
    guard gMainStackReady else {
      NSLog("[Startup] Watchdog: stack capture timed out")
      return
    }
    let count = Int(gMainStackFrameCount)
    // Log the binary load slide so addresses can be symbolicated offline:
    //   atos -o Keybase.app.dSYM/Contents/Resources/DWARF/Keybase -l <slide> <address>
    let slide = _dyld_get_image_vmaddr_slide(0)
    NSLog("[Startup] Watchdog: main thread stack trace (%d frames, slide=0x%lx):", count, slide)
    gMainStackFrames.withUnsafeMutableBufferPointer { buf in
      if let syms = backtrace_symbols(buf.baseAddress, Int32(count)) {
        for i in 0..<count {
          NSLog("[Startup]   %s", syms[i]!)
        }
        free(syms)
      }
    }
  }

  private func startMainThreadWatchdog(context: String) {
    watchdogLock.lock()
    if watchdogActive {
      watchdogLock.unlock()
      return
    }
    watchdogActive = true
    let startTime = CFAbsoluteTimeGetCurrent()
    watchdogLastPong = startTime
    watchdogBgEnterTime = startTime
    watchdogLock.unlock()

    writeStartupTimingLog("Watchdog: started (\(context))")

    DispatchQueue(label: "kb.startup.watchdog", qos: .utility).async { [weak self] in
      var lastLogTime: CFAbsoluteTime = 0

      while true {
        Thread.sleep(forTimeInterval: 1.0)

        guard let self = self else { break }
        self.watchdogLock.lock()
        let active = self.watchdogActive
        let lastPong = self.watchdogLastPong
        let bgEnterTime = self.watchdogBgEnterTime
        self.watchdogLock.unlock()
        guard active else { break }

        let now = CFAbsoluteTimeGetCurrent()
        let blockDuration = now - lastPong

        // If blockDuration is very large, the process was suspended by iOS (not a main thread hang).
        // Reset the pong baseline and send one ping — the main thread should respond within a
        // few seconds once unfrozen. If it doesn't, we'll start reporting a hang next iteration.
        if blockDuration > 30.0 {
          let bgElapsedSec = now - bgEnterTime
          let msg = String(format: "Watchdog: process resumed after %.0fs suspension (%.0fs since background)", blockDuration, bgElapsedSec)
          NSLog("[Startup] %@", msg)
          self.watchdogLock.lock()
          self.watchdogLastPong = now
          self.watchdogLock.unlock()
          lastLogTime = 0
          DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.watchdogLock.lock()
            self.watchdogLastPong = CFAbsoluteTimeGetCurrent()
            self.watchdogLock.unlock()
          }
          continue
        }

        let totalElapsedMs = (now - AppDelegate.appStartTime) * 1000

        if blockDuration >= 3.0 {
          // Log at first detection, then every 5s to avoid spam
          if lastLogTime == 0 || (now - lastLogTime) >= 5.0 {
            let bgElapsedSec = now - bgEnterTime
            let msg = String(format: "Watchdog: main thread blocked %.0fs after foreground resume (%.0fs since background, %.0fms since launch)", blockDuration, bgElapsedSec, totalElapsedMs)
            NSLog("[Startup] %@", msg)
            // Enqueue a write for when the main thread recovers
            DispatchQueue.main.async { [weak self] in
              self?.writeStartupTimingLog(msg)
            }
            // Capture main thread stack on first detection
            if lastLogTime == 0 {
              self.logMainThreadStackTrace()
            }
            lastLogTime = now
          }
        } else {
          if lastLogTime != 0 {
            let bgElapsedSec = now - bgEnterTime
            let msg = String(format: "Watchdog: main thread unblocked (%.0fs since background, %.0fms since launch)", bgElapsedSec, totalElapsedMs)
            NSLog("[Startup] %@", msg)
            DispatchQueue.main.async { [weak self] in
              self?.writeStartupTimingLog(msg)
            }
            lastLogTime = 0
          }
        }

        // Ping: ask main thread to update the pong time
        DispatchQueue.main.async { [weak self] in
          guard let self = self else { return }
          self.watchdogLock.lock()
          self.watchdogLastPong = CFAbsoluteTimeGetCurrent()
          self.watchdogLock.unlock()
        }
      }
    }
  }

  private func stopMainThreadWatchdog() {
    watchdogLock.lock()
    let wasActive = watchdogActive
    watchdogActive = false
    watchdogLock.unlock()
    if wasActive {
      writeStartupTimingLog("Watchdog: stopped")
    }
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
