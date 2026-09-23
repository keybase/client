#import "KbLocationWatcher.h"

@implementation KbLocationWatcher {
  // Everything below is main thread only; the manager delivers its delegate
  // callbacks on the run loop of the thread that created it.
  CLLocationManager *_manager;
  BOOL _wanted;
  BOOL _running;
  void (^_onFix)(CLLocation *);
}

- (instancetype)initWithOnFix:(void (^)(CLLocation *))onFix {
  self = [super init];
  _onFix = [onFix copy];
  return self;
}

- (void)start {
  dispatch_async(dispatch_get_main_queue(), ^{
    self->_wanted = YES;
    [self apply];
  });
}

- (void)stop {
  dispatch_async(dispatch_get_main_queue(), ^{
    self->_wanted = NO;
    [self apply];
  });
}

// JS asks for the permission before starting; once the user answers, this
// starts watching if it is still wanted.
- (void)locationManagerDidChangeAuthorization:(CLLocationManager *)manager {
  [self apply];
}

- (void)locationManager:(CLLocationManager *)manager didUpdateLocations:(NSArray<CLLocation *> *)locations {
  if (!_running) return;
  for (CLLocation *location in locations) {
    if (location.horizontalAccuracy >= 0) {
      _onFix(location);
    }
  }
}

- (void)locationManager:(CLLocationManager *)manager didFailWithError:(NSError *)error {
  NSLog(@"KbLocationWatcher: location update failed: %@", error.localizedDescription);
}

- (void)apply {
  if (!_manager) {
    if (!_wanted) return;
    _manager = [CLLocationManager new];
    _manager.delegate = self;
  }
  CLAuthorizationStatus status = _manager.authorizationStatus;
  BOOL authorized =
      status == kCLAuthorizationStatusAuthorizedAlways || status == kCLAuthorizationStatusAuthorizedWhenInUse;
  if (_wanted && !authorized) {
    NSLog(@"KbLocationWatcher: not watching location: not authorized (status %d)", (int)status);
  }
  if (_wanted && authorized && !_running) {
    NSLog(@"KbLocationWatcher: starting location updates");
    _running = YES;
    // Needs the `location` UIBackgroundModes entry, or this throws.
    _manager.allowsBackgroundLocationUpdates = YES;
    _manager.desiredAccuracy = kCLLocationAccuracyHundredMeters;
    // The throttle's floor; JS applies the rest of it.
    _manager.distanceFilter = 65;
    _manager.activityType = CLActivityTypeOther;
    _manager.pausesLocationUpdatesAutomatically = YES;
    _manager.showsBackgroundLocationIndicator = YES;
    [_manager startUpdatingLocation];
    [_manager startMonitoringSignificantLocationChanges];
  } else if (_running && !(_wanted && authorized)) {
    NSLog(@"KbLocationWatcher: stopping location updates");
    _running = NO;
    [_manager stopUpdatingLocation];
    [_manager stopMonitoringSignificantLocationChanges];
  }
}

@end
