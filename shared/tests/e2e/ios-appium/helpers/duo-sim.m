// Runs inside the iPhone Duo simulator (xcrun simctl spawn).
//   duo-sim get                          the hinge angle, from CoreMotion
//   duo-sim set <from> <to>              sweeps the hinge 0-180 degrees, as Device Hub's hidden hinge
//                                        slider does; exits 0 once CoreMotion reports <to>, 1 after 3s
//   duo-sim touch <displayUUID> <u,v,ms>...
//                                        one finger on that display: down at the first point, moving to
//                                        each next one over its ms, up at the last. u,v are 0-1 in the
//                                        panel's native (portrait) axes. Simulator HID clients reach only
//                                        the main (outer) touchscreen, so this clones the display's
//                                        touchscreen as a virtual HID service and sends through the clone.
#import <Foundation/Foundation.h>
#import <dlfcn.h>
#import <objc/message.h>
#include <mach/mach_time.h>

typedef struct __IOHIDEvent *IOHIDEventRef;
typedef struct __IOHIDEventSystemClient *IOHIDEventSystemClientRef;
extern IOHIDEventRef IOHIDEventCreateVendorDefinedEvent(CFAllocatorRef, uint64_t, uint32_t usagePage, uint32_t usage,
                                                        uint32_t version, const uint8_t *data, CFIndex length,
                                                        uint32_t options);
extern IOHIDEventSystemClientRef IOHIDEventSystemClientCreateWithType(CFAllocatorRef, int type, CFDictionaryRef);
extern void IOHIDEventSystemClientDispatchEvent(IOHIDEventSystemClientRef, IOHIDEventRef);
extern CFDataRef IOCFSerialize(CFTypeRef, CFOptionFlags);

typedef struct __IOHIDServiceClient *IOHIDServiceClientRef;
extern CFArrayRef IOHIDEventSystemClientCopyServices(IOHIDEventSystemClientRef);
extern CFTypeRef IOHIDServiceClientCopyProperty(IOHIDServiceClientRef, CFStringRef);
extern IOHIDEventRef IOHIDEventCreateDigitizerEvent(CFAllocatorRef, uint64_t, uint32_t transducerType, uint32_t index,
                                                    uint32_t identity, uint32_t eventMask, uint32_t buttonMask, double x,
                                                    double y, double z, double tipPressure, double barrelPressure,
                                                    Boolean range, Boolean touch, uint32_t options);
extern IOHIDEventRef IOHIDEventCreateDigitizerFingerEvent(CFAllocatorRef, uint64_t, uint32_t index, uint32_t identity,
                                                          uint32_t eventMask, double x, double y, double z,
                                                          double tipPressure, double twist, Boolean range,
                                                          Boolean touch, uint32_t options);
extern void IOHIDEventAppendEvent(IOHIDEventRef parent, IOHIDEventRef child, uint32_t options);
extern void IOHIDEventSetIntegerValue(IOHIDEventRef, uint32_t field, CFIndex value);

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
    fprintf(stderr, "duo-sim: this simulator has no hinge\n");
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

static const uint32_t kMaskRange = 1 << 0, kMaskTouch = 1 << 1, kMaskPosition = 1 << 2, kMaskIdentity = 1 << 5;
static const uint32_t kIsDisplayIntegrated = (11 << 16) | 25;

@interface Clone : NSObject
@property(copy) NSDictionary *properties;
@property(strong) dispatch_semaphore_t enumerated;
@property(strong) id service;
@end

@implementation Clone
- (BOOL)setProperty:(id)value forKey:(NSString *)key forService:(id)service { return YES; }
- (id)propertyForKey:(NSString *)key forService:(id)service { return self.properties[key]; }
- (id)copyEventMatching:(NSDictionary *)matching forService:(id)service { return nil; }
- (BOOL)setOutputEvent:(id)event forService:(id)service { return YES; }
- (void)notification:(NSInteger)type withProperty:(NSDictionary *)property forService:(id)service {
  if (type == 10) dispatch_semaphore_signal(self.enumerated);  // the event system opened the service
}
- (BOOL)send:(double)x y:(double)y touching:(BOOL)touching moving:(BOOL)moving {
  uint64_t now = mach_absolute_time();
  uint32_t mask = moving ? kMaskPosition : (kMaskRange | kMaskTouch | kMaskIdentity);
  IOHIDEventRef hand = IOHIDEventCreateDigitizerEvent(NULL, now, 3, 0, 0, mask, 0, x, y, 0, 0, 0, touching, touching, 0);
  IOHIDEventRef finger =
      IOHIDEventCreateDigitizerFingerEvent(NULL, now, 1, 2, mask, x, y, 0, touching ? 1 : 0, 0, touching, touching, 0);
  IOHIDEventSetIntegerValue(hand, kIsDisplayIntegrated, 1);
  IOHIDEventSetIntegerValue(finger, kIsDisplayIntegrated, 1);
  IOHIDEventAppendEvent(hand, finger, 0);
  BOOL ok = ((BOOL(*)(id, SEL, id))objc_msgSend)(self.service, @selector(dispatchEvent:), (__bridge id)hand);
  CFRelease(finger);
  CFRelease(hand);
  return ok;
}
@end

static Clone *cloneFor(NSString *uuid) {
  IOHIDEventSystemClientRef client = IOHIDEventSystemClientCreateWithType(NULL, 1, NULL);
  NSArray *services = CFBridgingRelease(IOHIDEventSystemClientCopyServices(client));
  NSArray *keys = @[ @"PrimaryUsagePage", @"PrimaryUsage", @"DeviceUsagePairs", @"Product", @"Transport", @"Built-In",
                     @"DeviceTypeHint", @"displayUUID" ];
  NSMutableDictionary *found = nil;
  for (id s in services) {
    NSString *d = CFBridgingRelease(IOHIDServiceClientCopyProperty((__bridge IOHIDServiceClientRef)s, CFSTR("displayUUID")));
    NSNumber *page = CFBridgingRelease(IOHIDServiceClientCopyProperty((__bridge IOHIDServiceClientRef)s, CFSTR("PrimaryUsagePage")));
    if (page.intValue != 0x0D || ![d.uppercaseString isEqualToString:uuid.uppercaseString]) continue;
    found = [NSMutableDictionary dictionary];
    for (NSString *k in keys) {
      id v = CFBridgingRelease(IOHIDServiceClientCopyProperty((__bridge IOHIDServiceClientRef)s, (__bridge CFStringRef)k));
      if (v) found[k] = v;
    }
    found[@"Product"] = @"kb-e2e touchscreen";
    break;
  }
  CFRelease(client);
  if (!found) {
    fprintf(stderr, "duo-sim: no touchscreen for display %s\n", uuid.UTF8String);
    return nil;
  }
  if (!dlopen("/System/Library/PrivateFrameworks/HID.framework/HID", RTLD_NOW)) return nil;
  Clone *c = [Clone new];
  c.properties = found;
  c.enumerated = dispatch_semaphore_create(0);
  c.service = [NSClassFromString(@"HIDVirtualEventService") new];
  ((void (*)(id, SEL, id))objc_msgSend)(c.service, @selector(setDelegate:), c);
  ((void (*)(id, SEL, id))objc_msgSend)(c.service, @selector(setDispatchQueue:), dispatch_queue_create("kb.touch", NULL));
  ((void (*)(id, SEL))objc_msgSend)(c.service, @selector(activate));
  if (dispatch_semaphore_wait(c.enumerated, dispatch_time(DISPATCH_TIME_NOW, 3 * NSEC_PER_SEC)) != 0) {
    fprintf(stderr, "duo-sim: the virtual touchscreen never opened\n");
    return nil;
  }
  // events sent right after the service opens can be dropped
  usleep(500000);
  return c;
}

// one finger along the points (argv entries u,v,ms) on the display `uuid`
static int touch(NSString *uuid, int count, char **points) {
  Clone *c = cloneFor(uuid);
  if (!c) return 1;
  double px = 0, py = 0;
  BOOL ok = YES;
  for (int i = 0; i < count; i++) {
    double x, y, ms;
    if (sscanf(points[i], "%lf,%lf,%lf", &x, &y, &ms) != 3) return 64;
    if (i == 0) {
      ok = [c send:x y:y touching:YES moving:NO] && ok;
    } else {
      int steps = MAX(1, (int)(ms / 1000.0 * 60));
      for (int s = 1; s <= steps; s++) {
        usleep((useconds_t)(ms * 1000 / steps));
        ok = [c send:px + (x - px) * s / steps y:py + (y - py) * s / steps touching:YES moving:YES] && ok;
      }
    }
    px = x;
    py = y;
  }
  ok = [c send:px y:py touching:NO moving:NO] && ok;
  usleep(300000);  // let the last events drain before the service goes
  ((void (*)(id, SEL))objc_msgSend)(c.service, @selector(cancel));
  return ok ? 0 : 1;
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
      if (!ok) fprintf(stderr, "duo-sim: angle did not reach %.1f\n", target);
      usleep(100000);
      return ok ? 0 : 1;
    }
    if (argc >= 4 && !strcmp(argv[1], "touch")) return touch(@(argv[2]), argc - 3, argv + 3);
    fprintf(stderr, "usage: duo-sim get | duo-sim set <from> <to> | duo-sim touch <displayUUID> <u,v,ms>...\n");
    return 64;
  }
}
