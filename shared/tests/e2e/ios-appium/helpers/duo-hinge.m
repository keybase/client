// Runs inside the iPhone Duo simulator (xcrun simctl spawn). Sends the vendor HID event Device Hub's
// hidden hinge slider sends, and reads the hinge angle back from CoreMotion.
//   duo-hinge get
//   duo-hinge set <from> <to>   sweeps 0-180 degrees; exits 0 once CoreMotion reports <to>, 1 after 3s
#import <Foundation/Foundation.h>
#include <mach/mach_time.h>

typedef struct __IOHIDEvent *IOHIDEventRef;
typedef struct __IOHIDEventSystemClient *IOHIDEventSystemClientRef;
extern IOHIDEventRef IOHIDEventCreateVendorDefinedEvent(CFAllocatorRef, uint64_t, uint32_t usagePage, uint32_t usage,
                                                        uint32_t version, const uint8_t *data, CFIndex length,
                                                        uint32_t options);
extern IOHIDEventSystemClientRef IOHIDEventSystemClientCreateWithType(CFAllocatorRef, int type, CFDictionaryRef);
extern void IOHIDEventSystemClientDispatchEvent(IOHIDEventSystemClientRef, IOHIDEventRef);
extern CFDataRef IOCFSerialize(CFTypeRef, CFOptionFlags);

@interface CMAngle : NSObject
- (float)angleDegrees;
- (float)mechanicalAngleDegrees;
@end
@interface CMAngleManager : NSObject
+ (BOOL)isAvailable;
- (void)startAngleUpdatesToQueue:(NSOperationQueue *)queue handler:(void (^)(CMAngle *))handler;
- (void)stopAngleUpdates;
@end

static double reported(CMAngle *a) {
  // From iOS 27.3 angleDegrees settles a few degrees off; the mechanical angle is the one sent.
  return [a respondsToSelector:@selector(mechanicalAngleDegrees)] ? [a mechanicalAngleDegrees] : [a angleDegrees];
}

// Device Hub's provider name differs between CoreSimulator versions; each event carries an absolute
// angle, so sending it under both is harmless.
static void sendAngle(IOHIDEventSystemClientRef client, double degrees) {
  for (NSString *provider in @[ @"com.apple.Virtualization.VirtualMachines", @"com.apple.Virtualization" ]) {
    NSDictionary *payload = @{
      @"provider" : provider,
      @"source" : @"hinge-slider-control",
      @"type" : @"range",
      @"value" : @(degrees),
    };
    CFDataRef data = IOCFSerialize((__bridge CFTypeRef)payload, 1);
    IOHIDEventRef event = IOHIDEventCreateVendorDefinedEvent(NULL, mach_absolute_time(), 0xFF61, 0x5B, 0,
                                                             CFDataGetBytePtr(data), CFDataGetLength(data), 0);
    IOHIDEventSystemClientDispatchEvent(client, event);
    CFRelease(event);
    CFRelease(data);
  }
}

// Calls `start` after updates begin, then waits up to 3s for `done` to accept an update.
static BOOL watch(void (^start)(void), BOOL (^done)(CMAngle *)) {
  Class cls = NSClassFromString(@"CMAngleManager");
  if (!cls || ![cls isAvailable]) {
    fprintf(stderr, "duo-hinge: this simulator has no hinge\n");
    return NO;
  }
  CMAngleManager *m = [cls new];
  __block BOOL ok = NO;
  [m startAngleUpdatesToQueue:[NSOperationQueue new]
                      handler:^(CMAngle *a) {
                        if (!ok && done(a)) ok = YES;
                      }];
  if (start) start();
  NSDate *deadline = [NSDate dateWithTimeIntervalSinceNow:3];
  while (!ok && [deadline timeIntervalSinceNow] > 0) CFRunLoopRunInMode(kCFRunLoopDefaultMode, 0.05, false);
  [m stopAngleUpdates];
  return ok;
}

int main(int argc, char **argv) {
  @autoreleasepool {
    if (argc == 2 && !strcmp(argv[1], "get")) {
      __block double v = -1;
      if (!watch(nil, ^BOOL(CMAngle *a) { v = reported(a); return YES; })) return 1;
      printf("%.1f\n", v);
      return 0;
    }
    if (argc == 4 && !strcmp(argv[1], "set")) {
      // A jump straight between closed and open leaves the screens unswitched on iOS 27.1, so move
      // the hinge from <from> to <to> over 0.5s, the way Device Hub's slider does.
      double from = atof(argv[2]), target = atof(argv[3]);
      if (from < 0 || from > 180 || target < 0 || target > 180) return 64;
      IOHIDEventSystemClientRef client = IOHIDEventSystemClientCreateWithType(NULL, 4, NULL);
      BOOL ok = watch(^{
        for (int i = 0; i <= 30; i++) {
          sendAngle(client, from + (target - from) * i / 30);
          if (i < 30) usleep(500000 / 30);
        }
      }, ^BOOL(CMAngle *a) { return fabs(reported(a) - target) <= 0.5; });
      if (!ok) fprintf(stderr, "duo-hinge: angle did not reach %.1f\n", target);
      usleep(100000);
      return ok ? 0 : 1;
    }
    fprintf(stderr, "usage: duo-hinge get | duo-hinge set <from> <to>\n");
    return 64;
  }
}
