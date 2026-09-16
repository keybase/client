import CoreLocation
import Keybasego
import UIKit
import os

private let log = Logger(subsystem: "com.keybase.app", category: "location")

// Runs the OS location service for live location (go/chat/maps) without JS. Go
// starts and stops watching; each fix goes back to Go. Created in
// didFinishLaunching, before Go restores its trackers, so an app relaunched by
// significant-change monitoring starts watching again. Its options match the
// expo-location background task it replaced.
final class LocationWatcher: NSObject, Keybasego.KeybaseNativeLocationWatcherProtocol, CLLocationManagerDelegate {
  // In the background a fix is only reported once the device has moved this far
  // since the last one reported.
  private static let deferredUpdatesDistance: CLLocationDistance = 65

  // Everything below is main thread only.
  private let manager = CLLocationManager()
  private var wanted = false
  private var running = false
  private var lastReported: CLLocation?
  private var pending: CLLocation?
  private var pendingDistance: CLLocationDistance = 0

  private let goQueue = DispatchQueue(label: "com.keybase.app.location", qos: .utility)

  override init() {
    super.init()
    manager.delegate = self
  }

  // Called by Go on a Go thread.
  func startWatching() {
    DispatchQueue.main.async {
      self.wanted = true
      self.apply()
    }
  }

  func stopWatching() {
    DispatchQueue.main.async {
      self.wanted = false
      self.apply()
    }
  }

  // The prompt is asked for in JS when sharing starts; once the user answers,
  // this starts watching if Go still wants it.
  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    apply()
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard running else { return }
    for location in locations where location.horizontalAccuracy >= 0 {
      if let previous = pending ?? lastReported {
        pendingDistance += location.distance(from: previous)
      }
      pending = location
    }
    guard let location = pending,
          UIApplication.shared.applicationState == .active || pendingDistance >= Self.deferredUpdatesDistance
    else { return }
    lastReported = location
    pending = nil
    pendingDistance = 0
    let coordinate = location.coordinate
    let accuracy = Int(location.horizontalAccuracy)
    goQueue.async {
      Keybasego.KeybaseLocationUpdate(coordinate.latitude, coordinate.longitude, accuracy)
    }
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    log.error("location update failed: \(error.localizedDescription, privacy: .public)")
  }

  private func apply() {
    let status = manager.authorizationStatus
    let authorized = status == .authorizedAlways || status == .authorizedWhenInUse
    if wanted && !authorized {
      log.warning("not watching location: not authorized (status \(status.rawValue))")
    }
    if wanted && authorized && !running {
      log.info("starting location updates")
      running = true
      manager.allowsBackgroundLocationUpdates = true
      manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
      manager.distanceFilter = kCLDistanceFilterNone
      manager.activityType = .other
      manager.pausesLocationUpdatesAutomatically = true
      manager.showsBackgroundLocationIndicator = true
      manager.startUpdatingLocation()
      manager.startMonitoringSignificantLocationChanges()
    } else if running && !(wanted && authorized) {
      log.info("stopping location updates")
      running = false
      manager.stopUpdatingLocation()
      manager.stopMonitoringSignificantLocationChanges()
      lastReported = nil
      pending = nil
      pendingDistance = 0
    }
  }
}
