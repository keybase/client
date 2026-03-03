import Foundation
import QuartzCore
import UIKit
import os

private let log = Logger(subsystem: "com.keybase.app", category: "perf")

/// Lightweight FPS monitor using CADisplayLink.
/// Activated by the `-PERF_FPS_MONITOR` launch argument.
/// Writes per-second FPS samples to a JSON file in the app's tmp directory.
@objc final class PerfFPSMonitor: NSObject {
    static let shared = PerfFPSMonitor()
    static let outputPath = NSTemporaryDirectory() + "perf-fps.json"

    private var displayLink: CADisplayLink?
    private var lastTimestamp: CFTimeInterval = 0
    private var frameCount: Int = 0
    private var samples: [Int] = []
    private var running = false

    /// Call from AppDelegate. Starts only if `-PERF_FPS_MONITOR` launch arg is present.
    @objc static func startIfEnabled() {
        guard ProcessInfo.processInfo.arguments.contains("-PERF_FPS_MONITOR") else { return }
        shared.start()
    }

    func start() {
        guard !running else { return }
        running = true
        frameCount = 0
        lastTimestamp = 0
        samples = []

        // Remove stale output
        try? FileManager.default.removeItem(atPath: PerfFPSMonitor.outputPath)

        displayLink = CADisplayLink(target: self, selector: #selector(tick))
        // Use .common so it fires during scroll tracking
        displayLink?.add(to: .main, forMode: .common)

        log.info("PerfFPSMonitor: started")
    }

    func stop() {
        guard running else { return }
        running = false
        displayLink?.invalidate()
        displayLink = nil
        // flush last partial second
        if frameCount > 0 {
            samples.append(frameCount)
        }
        writeResults()
        log.info("PerfFPSMonitor: stopped, wrote \(self.samples.count) samples to \(PerfFPSMonitor.outputPath, privacy: .public)")
    }

    @objc private func tick(_ link: CADisplayLink) {
        if lastTimestamp == 0 {
            lastTimestamp = link.timestamp
            frameCount = 1
            return
        }

        frameCount += 1

        let elapsed = link.timestamp - lastTimestamp
        if elapsed >= 1.0 {
            samples.append(frameCount)
            frameCount = 0
            lastTimestamp = link.timestamp
        }
    }

    private func writeResults() {
        guard !samples.isEmpty else { return }
        let sorted = samples.sorted()
        let sum = samples.reduce(0, +)
        let avg = Double(sum) / Double(samples.count)
        let min = sorted.first ?? 0
        let max = sorted.last ?? 0
        let p5Idx = Swift.max(0, Int(ceil(Double(sorted.count) * 0.05)) - 1)
        let p5 = sorted[p5Idx]

        let result: [String: Any] = [
            "fps": [
                "avg": round(avg * 10) / 10,
                "min": min,
                "max": max,
                "p5": p5,
                "samples": samples
            ],
            "durationSeconds": samples.count
        ]

        if let data = try? JSONSerialization.data(withJSONObject: result, options: .prettyPrinted) {
            try? data.write(to: URL(fileURLWithPath: PerfFPSMonitor.outputPath))
        }
    }

    /// Write results on app background so data is available after test
    @objc static func appDidEnterBackground() {
        if shared.running {
            shared.stop()
        }
    }
}
