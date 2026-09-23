#import <CoreLocation/CoreLocation.h>
#import <Foundation/Foundation.h>

// Runs the OS location service for live location sharing. start and stop may be
// called from any thread; onFix runs on the main thread for every fix with a
// valid accuracy, unthrottled past the distance filter (JS decides which to
// record).
@interface KbLocationWatcher : NSObject <CLLocationManagerDelegate>
- (instancetype)initWithOnFix:(void (^)(CLLocation *location))onFix;
- (void)start;
- (void)stop;
@end
