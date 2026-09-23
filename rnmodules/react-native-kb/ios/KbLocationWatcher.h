#import <CoreLocation/CoreLocation.h>
#import <Foundation/Foundation.h>

// Runs the OS location service for live location sharing. start and stop may be
// called from any thread and take effect in call order; onFix runs on the main
// thread for every fix with a valid accuracy past the distance filter (JS
// decides which to record).
@interface KbLocationWatcher : NSObject <CLLocationManagerDelegate>
- (instancetype)initWithAppActive:(BOOL)appActive onFix:(void (^)(CLLocation *location))onFix;
- (void)start;
// Also stops monitoring a previous process left running: significant-change
// monitoring survives termination.
- (void)stop;
// Main thread only. Active: every fix; otherwise only moves past 65 m.
- (void)setAppActive:(BOOL)appActive;
@end
