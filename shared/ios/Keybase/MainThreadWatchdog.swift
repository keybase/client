import UIKit
import Darwin

// File-scope globals required by the SIGUSR1 signal handler.
// Signal handlers cannot safely reference Swift objects, so these must be C-compatible globals.
private let kMaxStackFrames: Int32 = 128
private var gMainStackFrames = [UnsafeMutableRawPointer?](repeating: nil, count: Int(kMaxStackFrames))
private var gMainStackFrameCount: Int32 = 0
private var gMainStackReady: Bool = false

// Monitors the main thread for hangs by pinging it every second from a background thread.
// Captures a stack trace via SIGUSR1 on first hang detection.
//
// Lifecycle:
//   1. Call install() once on the main thread at app startup.
//   2. Call start(context:) when entering background (or at cold start).
//   3. Call stop() at the top of applicationDidBecomeActive.
class MainThreadWatchdog {
  private var active = false
  private let lock = NSLock()
  private var lastPong: CFAbsoluteTime = 0
  private var bgEnterTime: CFAbsoluteTime = 0
  private var isBackgroundContext = false

  private var mainThreadPthread: pthread_t?
  private let appStartTime: CFAbsoluteTime
  private let writeLog: (String) -> Void

  init(appStartTime: CFAbsoluteTime, writeLog: @escaping (String) -> Void) {
    self.appStartTime = appStartTime
    self.writeLog = writeLog
  }

  // Must be called from the main thread. Captures pthread_self() and installs
  // the SIGUSR1 handler that records the main thread stack on demand.
  func install() {
    mainThreadPthread = pthread_self()
    signal(SIGUSR1) { _ in
      gMainStackFrameCount = backtrace(&gMainStackFrames, kMaxStackFrames)
      gMainStackReady = true
    }
  }

  func start(context: String) {
    lock.lock()
    if active {
      lock.unlock()
      return
    }
    active = true
    let now = CFAbsoluteTimeGetCurrent()
    lastPong = now
    bgEnterTime = now
    isBackgroundContext = (context == "background entered")
    lock.unlock()

    writeLog("Watchdog: started (\(context))")

    DispatchQueue(label: "kb.startup.watchdog", qos: .utility).async { [weak self] in
      self?.run()
    }
  }

  func stop() {
    lock.lock()
    let wasActive = active
    active = false
    lock.unlock()
    if wasActive {
      writeLog("Watchdog: stopped")
    }
  }

  // MARK: - Private

  private func run() {
    var lastLogTime: CFAbsoluteTime = 0

    while true {
      Thread.sleep(forTimeInterval: 0.5)

      lock.lock()
      let isActive = active
      let lastPong = self.lastPong
      let bgEnterTime = self.bgEnterTime
      let isBackgroundContext = self.isBackgroundContext
      lock.unlock()
      guard isActive else { break }

      let now = CFAbsoluteTimeGetCurrent()
      let blockDuration = now - lastPong

      // If the process was suspended by iOS, blockDuration reflects the suspension gap rather
      // than a real main-thread hang. Two cases:
      //   1. Background-entered watchdog: ANY gap >= 3s is a suspension — iOS suspends apps
      //      aggressively even after a few seconds in the background, so the 30s threshold
      //      below is too coarse and produces false positives for 5–29s suspensions.
      //   2. Cold-start or foreground watchdog: use the 30s threshold as before.
      if blockDuration > 30.0 || (isBackgroundContext && blockDuration >= 3.0) {
        let bgElapsedSec = now - bgEnterTime
        let msg = String(format: "Watchdog: process resumed after %.0fs suspension (%.0fs since background)", blockDuration, bgElapsedSec)
        NSLog("[Startup] %@", msg)
        lock.lock()
        self.lastPong = now
        lock.unlock()
        lastLogTime = 0
        DispatchQueue.main.async { [weak self] in
          guard let self else { return }
          self.lock.lock()
          self.lastPong = CFAbsoluteTimeGetCurrent()
          self.lock.unlock()
        }
        continue
      }

      let totalElapsedMs = (now - appStartTime) * 1000

      if blockDuration >= 1.0 {
        // Sample every 1s for the duration of the hang so we capture how the main thread
        // evolves (e.g. keychain IPC → rendering → idle) rather than a single snapshot.
        if lastLogTime == 0 || (now - lastLogTime) >= 1.0 {
          let bgElapsedSec = now - bgEnterTime
          let msg = String(format: "Watchdog: main thread blocked %.1fs after foreground resume (%.0fs since background, %.0fms since launch)", blockDuration, bgElapsedSec, totalElapsedMs)
          NSLog("[Startup] %@", msg)
          // Enqueue a write for when the main thread recovers
          DispatchQueue.main.async { [weak self] in
            self?.writeLog(msg)
          }
          // Capture a stack trace on every sample interval, not just the first.
          captureAndLogStackTrace()
          lastLogTime = now
        }
      } else {
        if lastLogTime != 0 {
          let bgElapsedSec = now - bgEnterTime
          let msg = String(format: "Watchdog: main thread unblocked (%.0fs since background, %.0fms since launch)", bgElapsedSec, totalElapsedMs)
          NSLog("[Startup] %@", msg)
          DispatchQueue.main.async { [weak self] in
            self?.writeLog(msg)
          }
          lastLogTime = 0
        }
      }

      // Ping: ask main thread to update the pong time
      DispatchQueue.main.async { [weak self] in
        guard let self else { return }
        self.lock.lock()
        self.lastPong = CFAbsoluteTimeGetCurrent()
        self.lock.unlock()
      }
    }
  }

  // Send SIGUSR1 to the main thread, wait briefly for the handler to run, then log the stack.
  // Frames are collected synchronously here on the watchdog thread, then dispatched to the main
  // thread via writeLog so they appear in ios.log (captured by logsend).
  private func captureAndLogStackTrace() {
    gMainStackReady = false
    guard let tid = mainThreadPthread else {
      DispatchQueue.main.async { [weak self] in self?.writeLog("Watchdog: main thread pthread not captured") }
      return
    }
    pthread_kill(tid, SIGUSR1)
    // Spin up to 200ms for the signal handler to complete
    for _ in 0..<20 {
      if gMainStackReady { break }
      Thread.sleep(forTimeInterval: 0.01)
    }
    guard gMainStackReady else {
      DispatchQueue.main.async { [weak self] in self?.writeLog("Watchdog: stack capture timed out") }
      return
    }
    let count = Int(gMainStackFrameCount)
    // Collect the binary load slide so addresses can be symbolicated offline:
    //   atos -o Keybase.app.dSYM/Contents/Resources/DWARF/Keybase -l <slide> <address>
    let slide = _dyld_get_image_vmaddr_slide(0)
    // Build the frame strings synchronously while the globals are still valid, then
    // dispatch a single block to write them all once the main thread unblocks.
    var lines = [String]()
    lines.append(String(format: "Watchdog: main thread stack trace (%d frames, slide=0x%lx):", count, slide))
    gMainStackFrames.withUnsafeMutableBufferPointer { buf in
      if let syms = backtrace_symbols(buf.baseAddress, Int32(count)) {
        for i in 0..<count {
          lines.append("  \(String(cString: syms[i]!))")
        }
        free(syms)
      }
    }
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      for line in lines { self.writeLog(line) }
    }
  }
}
