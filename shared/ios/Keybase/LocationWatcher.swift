import CoreLocation
import Keybasego
import os

private let log = Logger(subsystem: "com.keybase.app", category: "location")

// Runs the OS location service for live location (go/chat/maps) without JS. Go
// starts and stops watching; every fix goes back to Go, which decides which to
// record. Created in didFinishLaunching, before Go restores its trackers, so an
// app relaunched by significant-change monitoring starts watching again. Its
// CLLocationManager options match expo-location's background task, which
// Android still uses.
final class LocationWatcher: NSObject, Keybasego.KeybaseNativeLocationWatcherProtocol, CLLocationManagerDelegate {
  // Everything below is main thread only.
  private let manager = CLLocationManager()
  private var wanted = false
  private var running = false

  // Go records a fix to disk, so fixes go to it off the main thread, in order.
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
    let fixes = locations.filter { $0.horizontalAccuracy >= 0 }.map {
      (coordinate: $0.coordinate, accuracy: Int($0.horizontalAccuracy))
    }
    goQueue.async {
      for fix in fixes {
        Keybasego.KeybaseLocationUpdate(fix.coordinate.latitude, fix.coordinate.longitude, fix.accuracy)
      }
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
    }
  }
}
