#import "KbLocationWatcher.h"

// The JS throttle's floor for fixes outside the foreground.
static const CLLocationDistance kbBackgroundDistanceFilter = 65;

@implementation KbLocationWatcher {
  // Everything below is main thread only once init returns; the manager
  // delivers its delegate callbacks on the run loop of the thread that created
  // it.
  CLLocationManager *_manager;
  BOOL _wanted;
  BOOL _running;
  BOOL _appActive;
  void (^_onFix)(CLLocation *);
}

- (instancetype)initWithAppActive:(BOOL)appActive onFix:(void (^)(CLLocation *))onFix {
  self = [super init];
  _appActive = appActive;
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

- (void)setAppActive:(BOOL)appActive {
  _appActive = appActive;
  if (_manager) {
    _manager.distanceFilter = [self distanceFilter];
  }
}

- (CLLocationDistance)distanceFilter {
  return _appActive ? kCLDistanceFilterNone : kbBackgroundDistanceFilter;
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
    _manager = [CLLocationManager new];
    _manager.delegate = self;
  }
  CLAuthorizationStatus status = _manager.authorizationStatus;
  BOOL authorized =
      status == kCLAuthorizationStatusAuthorizedAlways || status == kCLAuthorizationStatusAuthorizedWhenInUse;
  if (_wanted && !authorized) {
    NSLog(@"KbLocationWatcher: not watching location: not authorized (status %d)", (int)status);
  }
  if (_wanted && authorized) {
    if (_running) return;
    NSLog(@"KbLocationWatcher: starting location updates");
    _running = YES;
    // Needs the `location` UIBackgroundModes entry, or this throws.
    _manager.allowsBackgroundLocationUpdates = YES;
    _manager.desiredAccuracy = kCLLocationAccuracyHundredMeters;
    _manager.distanceFilter = [self distanceFilter];
    _manager.activityType = CLActivityTypeOther;
    _manager.pausesLocationUpdatesAutomatically = YES;
    _manager.showsBackgroundLocationIndicator = YES;
    [_manager startUpdatingLocation];
    [_manager startMonitoringSignificantLocationChanges];
  } else {
    if (_running) {
      NSLog(@"KbLocationWatcher: stopping location updates");
    }
    _running = NO;
    [_manager stopUpdatingLocation];
    [_manager stopMonitoringSignificantLocationChanges];
  }
}

@end
