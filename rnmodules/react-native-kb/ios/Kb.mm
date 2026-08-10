#import "Kb.h"
#import "Keybasego.h"
#import "engine-reset-backoff.h"
#import <Foundation/Foundation.h>
#import <React/RCTEventDispatcher.h>
#import <ReactCommon/CallInvoker.h>
#import <React/RCTCallInvoker.h>
#import <React/RCTUtils.h>
#import <QuartzCore/QuartzCore.h>
#import <UIKit/UIKit.h>
#import <UserNotifications/UserNotifications.h>
#import <cstring>
#import <jsi/jsi.h>
#import <memory>
#import <mutex>
#import <sys/utsname.h>
#import <objc/runtime.h>
#import "RNKbSpec.h"
#import <KBCommon/KBCommon-Swift.h>

using namespace facebook::jsi;
using namespace facebook;
using namespace std;
using namespace kb;

@implementation FsPathsHolder

@synthesize fsPaths;

+ (id)sharedFsPathsHolder {
  static FsPathsHolder *sharedMyManager = nil;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    sharedMyManager = [[self alloc] init];
  });
  return sharedMyManager;
}

@end

static NSString *const metaEventEngineReset = @"kb-engine-reset";

static __weak Kb *kbSharedInstance = nil;
// Guards the compare-and-clear in invalidate against init's write: init runs
// on the main thread, invalidate on the TurboModule shared method queue, and
// the __weak load/store are each individually synchronized but the
// read-then-write in invalidate is not, so without this lock a reload's new
// instance can be clobbered by the old instance's invalidate.
static std::mutex kbSharedInstanceMutex;
static BOOL kbPasteImageEnabled = NO;
static NSString *kbStoredDeviceToken = nil;
static NSDictionary *kbInitialNotification = nil;

// The bridge is created on the JS thread and consumed by the reader thread,
// so every access goes through this lock — a plain shared_ptr member would be
// a data race between installJSIBindings/invalidate and the reader.
static std::mutex kbBridgeMutex;
static std::shared_ptr<kb::KBBridge> kbCurrentBridge;

static std::shared_ptr<kb::KBBridge> kbGetBridge(void) {
  std::lock_guard<std::mutex> lock(kbBridgeMutex);
  return kbCurrentBridge;
}

// REQUIRES kbBridgeMutex. Publishes `bridge` as the current one and hands the
// displaced bridge back to the caller, which must markTornDown() it *after*
// releasing the lock (markTornDown only flips an atomic, but nothing that can
// re-enter this file may run under kbBridgeMutex; releasing the old bridge's
// jsi handles is the JS runtime's job -- see the kbTeardown host object).
//
// Lock-requiring rather than lock-taking so the caller can publish myBridge_
// and kbCurrentBridge in ONE critical section; see
// installJSIBindingsWithRuntime.
static std::shared_ptr<kb::KBBridge>
kbSetBridgeLocked(std::shared_ptr<kb::KBBridge> bridge) {
  std::shared_ptr<kb::KBBridge> old = std::move(kbCurrentBridge);
  kbCurrentBridge = std::move(bridge);
  return old;
}

// Clears the installed bridge only if it is still `mine`. A module's
// invalidate can run *after* the next module already installed its bridge
// (RCTInstance::invalidate hops to the old JS thread asynchronously, and
// RCTTurboModuleManager only waits 10s before proceeding), so an
// unconditional clear would tear down the live bridge and wedge the app
// with no desync and no reset to recover from.
static bool kbClearBridgeIfCurrent(const std::shared_ptr<kb::KBBridge> &mine) {
  std::shared_ptr<kb::KBBridge> old;
  {
    std::lock_guard<std::mutex> lock(kbBridgeMutex);
    if (!mine || kbCurrentBridge != mine) {
      return false;
    }
    old = std::move(kbCurrentBridge);
    kbCurrentBridge = nullptr;
  }
  old->markTornDown();
  return true;
}

static void kbLogToService(NSString *message) {
  KeybaseLogToService([NSString
      stringWithFormat:@"dNativeLogger: [%f,\"%@\"]",
                       [[NSDate date] timeIntervalSince1970] * 1000, message]);
}

// from react-native-localize
static bool kbUses24HourClockForLocale(NSLocale *_Nonnull locale) {
  NSDateFormatter *formatter = [NSDateFormatter new];

  [formatter setLocale:locale];
  [formatter setTimeZone:[NSTimeZone timeZoneForSecondsFromGMT:0]];
  [formatter setDateStyle:NSDateFormatterNoStyle];
  [formatter setTimeStyle:NSDateFormatterShortStyle];

  NSDate *date = [NSDate dateWithTimeIntervalSince1970:72000];
  return [[formatter stringFromDate:date] containsString:@"20"];
}

static NSString *kbSetupServerConfig(void) {
  NSArray *paths = NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES);
  NSString *cachePath = [paths objectAtIndex:0];
  NSString *filePath = [cachePath stringByAppendingPathComponent:@"/Keybase/keybase.app.serverConfig"];
  NSError *err;
  NSString *val = [NSString stringWithContentsOfFile:filePath
                                            encoding:NSUTF8StringEncoding
                                               error:&err];
  if (err != nil || val == nil) {
    return @"";
  }
  return val;
}

static NSString *kbSetupGuiConfig(void) {
  NSString *filePath = [[[FsPathsHolder sharedFsPathsHolder] fsPaths][@"sharedHome"]
          stringByAppendingPathComponent: @"/Library/Application Support/Keybase/gui_config.json"];
  NSError *err;
  NSString *val = [NSString stringWithContentsOfFile:filePath encoding:NSUTF8StringEncoding error:&err];
  if (err != nil || val == nil) {
    return @"";
  }
  return val;
}

// Built once; safe because fsPaths and KeybaseInit are set up in the app
// delegate before React Native creates this module. guiConfig is NOT cached
// here: it changes at runtime (route persistence), so getTypedConstants
// re-reads it per call.
static NSDictionary *kbConstants(void) {
  static NSDictionary *constants = nil;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    NSString *serverConfig = kbSetupServerConfig();

    NSString *appVersionString = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"];
    if (appVersionString == nil) {
      appVersionString = @"";
    }
    NSString *appBuildString = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleVersion"];
    if (appBuildString == nil) {
      appBuildString = @"";
    }
    NSLocale *currentLocale = [NSLocale currentLocale];
    NSString *cacheDir = [NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES) firstObject];
    NSString *downloadDir = [NSSearchPathForDirectoriesInDomains(NSDownloadsDirectory, NSUserDomainMask, YES) firstObject];

    NSString *kbVersion = KeybaseVersion();
    if (kbVersion == nil) {
      kbVersion = @"";
    }
    constants = @{
      @"androidIsDeviceSecure" : @NO,
      @"androidIsTestDevice" : @NO,
      @"appVersionCode" : appBuildString,
      @"appVersionName" : appVersionString,
      @"darkModeSupported" : @YES,
      @"fsCacheDir" : cacheDir,
      @"fsDownloadDir" : downloadDir,
      @"serverConfig" : serverConfig,
      @"uses24HourClock" : @(kbUses24HourClockForLocale(currentLocale)),
      @"version" : kbVersion
    };
  });
  return constants;
}

@implementation Kb {
  // Guarded by kbBridgeMutex: written on the JS thread in
  // installJSIBindingsWithRuntime, read and cleared on the TurboModule shared
  // method queue in invalidate. Reusing kbBridgeMutex (rather than a second
  // lock) keeps this ivar and kbCurrentBridge consistent with each other
  // without ever nesting the two critical sections.
  std::shared_ptr<kb::KBBridge> myBridge_;
}

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

// _eventEmitterCallback is only set once JS creates the TurboModule; emitting
// through the generated helpers before then would call a null std::function.
- (BOOL)canEmit {
  return _eventEmitterCallback != nullptr;
}

- (instancetype)init {
  self = [super init];
  {
    std::lock_guard<std::mutex> lock(kbSharedInstanceMutex);
    kbSharedInstance = self;
  }
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(handleHardwareKeyPressed:)
                                               name:@"hardwareKeyPressed"
                                             object:nil];
  [Kb swizzleUITextViewPaste];
  // getTypedConstants is a blocking synchronous JS call that does file I/O;
  // warm the cache off the main/JS threads so startup doesn't stall on disk.
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    (void)kbConstants();
  });
  return self;
}

+ (void)swizzleUITextViewPaste {
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    Class cls = [UITextView class];

    SEL originalPaste = @selector(paste:);
    SEL swizzledPaste = NSSelectorFromString(@"kb_paste:");
    Method originalPasteMethod = class_getInstanceMethod(cls, originalPaste);
    Method swizzledPasteMethod = class_getInstanceMethod(cls, swizzledPaste);
    method_exchangeImplementations(originalPasteMethod, swizzledPasteMethod);

    SEL originalCanPerform = @selector(canPerformAction:withSender:);
    SEL swizzledCanPerform = NSSelectorFromString(@"kb_canPerformAction:withSender:");
    Method originalCanPerformMethod = class_getInstanceMethod(cls, originalCanPerform);
    Method swizzledCanPerformMethod = class_getInstanceMethod(cls, swizzledCanPerform);
    method_exchangeImplementations(originalCanPerformMethod, swizzledCanPerformMethod);
  });
}

+ (void)handlePastedImages:(NSArray<UIImage *> *)images {
  if (!kbSharedInstance || images.count == 0) return;

  // Encoding and writing pasted images can be slow for large images; keep it
  // off the main thread. The emit helpers are safe to call from any thread.
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    NSMutableArray *uris = [NSMutableArray array];
    for (UIImage *rawImage in images) {
      UIImage *image = rawImage;
      // UIImagePNGRepresentation encodes the raw pixels and PNG has no
      // orientation tag, so bake imageOrientation in by redrawing.
      if (image.imageOrientation != UIImageOrientationUp) {
        UIGraphicsImageRenderer *renderer =
            [[UIGraphicsImageRenderer alloc] initWithSize:image.size];
        UIImage *src = image;
        image = [renderer imageWithActions:^(UIGraphicsImageRendererContext *ctx) {
          [src drawInRect:CGRectMake(0, 0, src.size.width, src.size.height)];
        }];
      }
      NSData *data = UIImagePNGRepresentation(image);
      if (!data) continue;

      NSString *filename = [NSString stringWithFormat:@"paste_%@.png", [[NSUUID UUID] UUIDString]];
      NSString *tempPath = [NSTemporaryDirectory() stringByAppendingPathComponent:filename];

      if ([data writeToFile:tempPath atomically:YES]) {
        [uris addObject:tempPath];
      }
    }

    if (uris.count > 0) {
      Kb *instance = kbSharedInstance;
      if (instance && [instance canEmit]) {
        [instance emitOnPasteImage:uris];
      }
    }
  });
}

- (void)invalidate {
  [[NSNotificationCenter defaultCenter] removeObserver:self];
  kbPasteImageEnabled = NO;
  // RN never nulls _eventEmitterCallback on invalidate and the __weak ref
  // above only nils at dealloc, which lags this call — so without an explicit
  // clear, canEmit stays YES and a push notification, token registration or
  // (worst) the reader's desync meta event emits into the dying runtime's
  // invoker. Guarded because a reload may already have installed a newer
  // module as the shared instance; the lock makes the compare-and-clear
  // atomic with init's write so a newer instance can never be clobbered.
  {
    std::lock_guard<std::mutex> lock(kbSharedInstanceMutex);
    if (kbSharedInstance == self) {
      kbSharedInstance = nil;
    }
  }
  // Runs on the TurboModule shared method queue (no methodQueue getter, so
  // RCTTurboModuleManager assigns _sharedModuleQueue) — any thread, never the
  // JS thread. Only the atomic flag may be touched here; releasing jsi
  // handles off the runtime's thread is undefined behavior.
  //
  // Both the teardown and the Go reset are gated on still being the current
  // bridge: a reload can install the next module's bridge before this runs,
  // and clearing that one would leave the app wedged with no way to notice.
  std::shared_ptr<kb::KBBridge> mine;
  {
    std::lock_guard<std::mutex> lock(kbBridgeMutex);
    mine = myBridge_;
  }
  if (kbClearBridgeIfCurrent(mine)) {
    NSError *error = nil;
    KeybaseReset(&error);
  }
  {
    std::lock_guard<std::mutex> lock(kbBridgeMutex);
    myBridge_ = nullptr;
  }
}

RCT_EXPORT_METHOD(setEnablePasteImage:(BOOL)enabled) {
  kbPasteImageEnabled = enabled;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
(const facebook::react::ObjCTurboModule::InitParams &)params {
    return std::make_shared<facebook::react::NativeKbSpecJSI>(params);
}

// RCTTurboModuleWithJSIBindings — called automatically by RN when the module loads
- (void)installJSIBindingsWithRuntime:(jsi::Runtime &)runtime
                          callInvoker:(const std::shared_ptr<facebook::react::CallInvoker> &)callInvoker {
    auto bridge = std::make_shared<kb::KBBridge>();
    bridge->install(runtime, callInvoker,
        // writeToGo callback; false means the RPC never reached Go, so the
        // caller fails that invocation instead of waiting forever.
        [](void *ptr, size_t size) -> bool {
            NSData *data = [NSData dataWithBytesNoCopy:ptr length:size freeWhenDone:NO];
            NSError *error = nil;
            KeybaseWriteArr(data, &error);
            if (error) {
                kbLogToService([NSString stringWithFormat:@"rpc write failed: %@",
                                                          error.localizedDescription]);
                return false;
            }
            return true;
        },
        // error callback
        [](const std::string &err) {
            kbLogToService([NSString stringWithFormat:@"jsi error: %s", err.c_str()]);
        },
        // fatal callback: the incoming stream desynced. Reset the Go
        // connection and tell JS, so it fails outstanding RPCs rather than
        // leaving every caller hanging on a channel that can't recover.
        //
        // Also true since this can escalate for a msgpack->JSI conversion
        // failure or a missing rpcOnJs, arriving on the JS thread rather than
        // the reader thread -- either way recv_ still holds bytes from the
        // now-dead connection, so drop them here too or the next connection
        // desyncs on its very first frame. Captured weakly rather than by
        // shared_ptr: this lambda is stored inside the bridge's own onFatal_
        // member, so a strong capture would be a shared_ptr cycle.
        [weakBridge = std::weak_ptr<kb::KBBridge>(bridge)](int64_t epoch) {
            // Identity gate: only act if the bridge that faulted is still the
            // installed one. A batch queued by a dying runtime can hit its
            // conversion-failure fatal on the old JS thread after a reload
            // has already published the next module's bridge, and the epoch
            // check can't catch that (nothing re-dialed, so `epoch` is still
            // current) -- acting here would tear down the connection the new
            // runtime is already using, then clear the new bridge's parser
            // mid-frame, forcing a needless second fatal/reset cycle.
            auto strongBridge = weakBridge.lock();
            if (!strongBridge || kbGetBridge() != strongBridge) {
              kbLogToService(@"rpc stream desync from superseded bridge, ignoring");
              return;
            }
            kbLogToService(@"rpc stream desync, resetting connection");
            // Reset the Go connection before the parser: the reader thread is
            // still live on this path, so resetting the parser first would
            // leave a window where bytes from the OLD connection land in the
            // freshly-cleared unpacker mid-frame, causing a second desync.
            //
            // ResetIfCurrentDidReset(epoch), not Reset(): `epoch` is the
            // epoch of the connection the desynced bytes actually came from,
            // captured by the reader loop below at read time. If Go has
            // already re-dialed since (e.g. a concurrent WriteArr recovered
            // first), epoch no longer matches and this is a stale no-op
            // instead of tearing down a connection that already worked --
            // and in that case resetRecv() must also be skipped, or it drops
            // the new connection's already-in-flight partial frame and
            // forces a second, needless fatal/reset cycle.
            //
            // No @try around this call, unlike KbModule.onRpcStreamFatal's
            // catch-and-still-resetRecv: gomobile's ObjC glue has no
            // panic-to-NSException path (nothing in the generated bridge
            // recovers), so this either returns a BOOL or the process is
            // already dead. There is no "it threw, so reset the parser to be
            // safe" third outcome to handle here.
            BOOL didReset = KeybaseResetIfCurrentDidReset(epoch);
            if (didReset) {
              strongBridge->resetRecv();
            }
            dispatch_async(dispatch_get_main_queue(), ^{
                Kb *instance = kbSharedInstance;
                if (instance && [instance canEmit]) {
                    [instance emitOnMetaEvent:metaEventEngineReset];
                }
            });
        });

    // myBridge_ and kbCurrentBridge are published in ONE critical section.
    // Splitting them (set myBridge_, drop the lock, then set kbCurrentBridge)
    // opened a window where invalidate could read a non-null `mine` while
    // kbCurrentBridge was still the previous value: kbClearBridgeIfCurrent
    // then returned false, so BOTH the teardown and the KeybaseReset were
    // skipped, and this method went on to publish a bridge belonging to an
    // already-invalidated module that nothing would ever clean up.
    //
    // With the single critical section, myBridge_ is non-null only if
    // kbCurrentBridge was set to that same bridge under the same lock, so
    // invalidate's read of myBridge_ followed by kbClearBridgeIfCurrent can
    // only ever see the publish as all-or-nothing -- never half-done. (The
    // two are separate critical sections in invalidate, which is fine: they
    // only need the atomicity of the *publish*, not of their own pair.)
    std::shared_ptr<kb::KBBridge> old;
    {
      std::lock_guard<std::mutex> lock(kbBridgeMutex);
      myBridge_ = bridge;
      old = kbSetBridgeLocked(bridge);
    }
    // Outside the lock, by kbSetBridgeLocked's contract.
    if (old) {
      old->markTornDown();
    }
    kbLogToService(@"jsi install success (via installJSIBindings)");
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(getTypedConstants) {
  // gui_config.json changes at runtime (route persistence), and JS re-reads
  // these constants on a dev reload; a launch-time snapshot would restore a
  // stale route, so read it fresh on every call.
  NSMutableDictionary *constants = [kbConstants() mutableCopy];
  constants[@"guiConfig"] = kbSetupGuiConfig();
  return constants;
}

RCT_EXPORT_METHOD(shareListenersRegistered) {
}

// No current caller (kept for future use).
RCT_EXPORT_METHOD(engineReset) {
  NSError *error = nil;
  KeybaseReset(&error);
  if (auto bridge = kbGetBridge()) {
    bridge->resetRecv();
  }
  if ([self canEmit]) {
    [self emitOnMetaEvent:metaEventEngineReset];
  }
  if (error) {
    NSLog(@"Error in reset: %@", error);
  }
}

RCT_EXPORT_METHOD(notifyJSReady) {
  // KeybaseNotifyJSReady is a sync.Once on the Go side, so repeat calls after
  // a reload are free. It must not run on the JS thread — do it on the reader
  // queue, which is also where ReadArr is serviced.
  //
  // Exactly one reader exists for the life of the process. Go's ReadArr hands
  // back a view of a single shared buffer and is documented as "called
  // serially by the mobile run loops": a second concurrent reader corrupts
  // both deliveries. It can't be stopped either, because a parked ReadArr
  // ignores cancellation and would swallow the next message on its way out.
  // So the loop outlives any individual module instance and simply forwards
  // to whichever bridge is currently installed.
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    dispatch_queue_t readQueue =
        dispatch_queue_create("go_bridge_queue_read", DISPATCH_QUEUE_SERIAL);
    dispatch_async(readQueue, ^{
      KeybaseNotifyJSReady();
      NSLog(@"Notified Go that JS is ready, starting ReadArr loop");

      // Consecutive read-error count, used to rate-limit the log line below.
      // Reset to 0 on every genuine successful read so each new failure
      // episode gets its own "first 5" logging window, rather than picking
      // up mid-backoff from an earlier, unrelated episode.
      static int readErrorCount = 0;
      // Throttles the kb-engine-reset EMIT below, separately from
      // readErrorCount above -- they have different cadences and must not
      // share a counter. See cpp/engine-reset-backoff.h (and its unit test)
      // for the arithmetic. Reset alongside readErrorCount on the next
      // successful read.
      static kb::EngineResetEmitBackoff emitBackoff;
      while (true) {
        // The block never returns, so the queue's pool never drains on its
        // own — each iteration needs its own.
        @autoreleasepool {
          NSError *error = nil;
          NSData *data = KeybaseReadArr(&error);
          // Read immediately after ReadArr returns, not before it: ReadArr
          // records the epoch of the connection it actually read from under
          // connMutex as part of the call, and with exactly one permanent
          // reader for the life of the process (this loop) nothing can have
          // started a second ReadArr in between, so this is exact for the
          // bytes just returned -- unlike capturing the epoch before the
          // blocking call, which could race a redial that happens while this
          // read is in flight.
          int64_t epoch = KeybaseLastReadEpoch();
          if (error) {
            // ReadArr already called Reset() on the Go side, so the connection
            // JS thinks it has is gone and every in-flight RPC is dead. Tell
            // JS so it fails them instead of spinning forever, and drop any
            // half-parsed frame so the next connection starts clean.
            //
            // This retries every ~100ms below, so if the connection can't be
            // re-established this is a ~10Hz flood into the uploadable log.
            // Unlike the empty-read case above (a one-shot degenerate state)
            // a recurring read error is exactly what an operator needs to see
            // recur, so log the first few, then back off to every Nth rather
            // than going silent.
            readErrorCount++;
            if (readErrorCount <= 5 || readErrorCount % 50 == 0) {
              kbLogToService([NSString
                  stringWithFormat:@"rpc read error, connection reset (count=%d): %@",
                                   readErrorCount, error.localizedDescription]);
            }
            if (auto bridge = kbGetBridge()) {
              bridge->resetRecv();
            }
            // Only advance the backoff window when the emit is actually
            // deliverable now -- checked synchronously here rather than
            // inside the dispatched block, so a dropped notification (no
            // shared instance / not yet able to emit) costs nothing and the
            // very next failure gets another chance to notify JS promptly.
            Kb *instance = kbSharedInstance;
            bool deliverable = instance != nil && [instance canEmit];
            // CACurrentMediaTime is monotonic and immune to wall-clock/NTP
            // adjustments, unlike NSDate/[NSDate timeIntervalSinceReferenceDate]:
            // a backward clock correction during a read-error episode (plausible
            // at cold boot) must not suppress the kb-engine-reset emit.
            if (emitBackoff.shouldEmit(CACurrentMediaTime(), deliverable)) {
              // Re-check kbSharedInstance/canEmit inside the dispatched
              // block rather than reusing the reader-thread snapshot above:
              // an invalidate/reload can land between this dispatch and the
              // block running, and `_eventEmitterCallback` is never cleared
              // on invalidate, so emitting on a strongly-captured `instance`
              // here could deliver into a dying runtime's invoker.
              dispatch_async(dispatch_get_main_queue(), ^{
                Kb *emitInstance = kbSharedInstance;
                if (emitInstance && [emitInstance canEmit]) {
                  [emitInstance emitOnMetaEvent:metaEventEngineReset];
                }
              });
            }
            [NSThread sleepForTimeInterval:0.1];
            continue;
          }
          if (data.length == 0) {
            // Not the idle path: ReadArr blocks in LoopbackConn.Read until
            // there is data, so an empty non-error result is degenerate (it
            // needs n == 0 with no error, which a blocking read does not
            // produce). It is reachable if Init never ran and the shared
            // buffer is zero-length, which would otherwise spin silently.
            static BOOL loggedEmptyRead = NO;
            if (!loggedEmptyRead) {
              kbLogToService(@"rpc read returned no data; is Keybase initialized?");
              loggedEmptyRead = YES;
            }
            [NSThread sleepForTimeInterval:0.01];
            continue;
          }
          readErrorCount = 0;
          emitBackoff.reset();
          auto bridge = kbGetBridge();
          if (bridge) {
            bridge->onDataFromGo((uint8_t *)[data bytes], (int)[data length], epoch);
          }
        }
      }
    });
  });
}

@synthesize callInvoker = _callInvoker;

RCT_EXPORT_METHOD(logSend:(NSString *)status feedback:(NSString *)feedback sendLogs:(BOOL)sendLogs sendMaxBytes:(BOOL)sendMaxBytes traceDir:(NSString *)traceDir cpuProfileDir:(NSString *)cpuProfileDir resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  NSString *logId = nil;
  NSError *err = nil;
  logId = KeybaseLogSend(status, feedback, sendLogs, sendMaxBytes, traceDir, cpuProfileDir, &err);
  if (err == nil) {
    resolve(logId);
  } else {
    reject(@"log_send_error", err.localizedDescription, err);
  }
}

RCT_EXPORT_METHOD(iosGetHasShownPushPrompt: (RCTPromiseResolveBlock)resolve reject: (RCTPromiseRejectBlock)reject) {
  UNUserNotificationCenter *current = UNUserNotificationCenter.currentNotificationCenter;
  [current getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings *_Nonnull settings) {
    if (settings.authorizationStatus == UNAuthorizationStatusNotDetermined) {
      // We haven't asked yet
      resolve(@FALSE);
      return;
    }
    resolve(@TRUE);
    return;
  }];
}

// JS carries mobile paths with a file:// prefix (see normalizePath in styles), but
// AVFoundation wants a bare filesystem path. Prefix handling is a plain string
// slice on both sides to match normalizePath, which does no percent-encoding.
static NSString *kbBarePath(NSString *p) {
  return [p hasPrefix:@"file://"] ? [p substringFromIndex:7] : p;
}

static NSString *kbJSPath(NSString *p) {
  return [p hasPrefix:@"/"] ? [@"file://" stringByAppendingString:p] : p;
}

RCT_EXPORT_METHOD(processMedia:(NSString *)path isVideo:(BOOL)isVideo compress:(BOOL)compress startMs:(double)startMs endMs:(double)endMs removeAudio:(BOOL)removeAudio resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  NSURL *url = [NSURL fileURLWithPath:kbBarePath(path)];
  void (^done)(NSError *, NSURL *) = ^(NSError *error, NSURL *out) {
    if (error) {
      reject(@"process_media_error", error.localizedDescription, error);
    } else if (out) {
      resolve(kbJSPath(out.path));
    } else {
      reject(@"process_media_error", @"No output produced", nil);
    }
  };
  if (isVideo) {
    VideoEdit *edit = [[VideoEdit alloc] initWithStartMs:(NSInteger)startMs
                                                  endMs:(NSInteger)endMs
                                            removeAudio:removeAudio];
    [MediaUtils processVideoFromOriginal:url compress:compress edit:(edit.isNoop ? nil : edit) completion:done];
  } else {
    [MediaUtils processImageFromOriginal:url compress:compress completion:done];
  }
}

RCT_EXPORT_METHOD(checkPushPermissions: (RCTPromiseResolveBlock)resolve reject: (RCTPromiseRejectBlock)reject) {
  UNUserNotificationCenter *current = UNUserNotificationCenter.currentNotificationCenter;
  [current getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings *_Nonnull settings) {
    BOOL hasPermission = settings.authorizationStatus == UNAuthorizationStatusAuthorized;
    if (hasPermission) {
      dispatch_async(dispatch_get_main_queue(), ^{
        [[UIApplication sharedApplication] registerForRemoteNotifications];
      });
    }
    resolve(@(hasPermission));
  }];
}

RCT_EXPORT_METHOD(requestPushPermissions: (RCTPromiseResolveBlock)resolve reject: (RCTPromiseRejectBlock)reject) {
  UNUserNotificationCenter *current = UNUserNotificationCenter.currentNotificationCenter;
  UNAuthorizationOptions options = UNAuthorizationOptionAlert | UNAuthorizationOptionBadge | UNAuthorizationOptionSound;
  [current requestAuthorizationWithOptions:options completionHandler:^(BOOL granted, NSError * _Nullable error) {
    if (error) {
      reject(@"permission_error", error.localizedDescription, error);
    } else {
      if (granted) {
        dispatch_async(dispatch_get_main_queue(), ^{
          [[UIApplication sharedApplication] registerForRemoteNotifications];
        });
      }
      resolve(@(granted));
    }
  }];
}

RCT_EXPORT_METHOD(getRegistrationToken: (RCTPromiseResolveBlock)resolve reject: (RCTPromiseRejectBlock)reject) {
  if (kbStoredDeviceToken) {
    resolve(kbStoredDeviceToken);
  } else {
    reject(@"no_token", @"Device token not yet registered", nil);
  }
}

RCT_EXPORT_METHOD(setApplicationIconBadgeNumber: (double)badgeNumber) {
  dispatch_async(dispatch_get_main_queue(), ^{
    [UIApplication sharedApplication].applicationIconBadgeNumber = (NSInteger)badgeNumber;
  });
}

RCT_EXPORT_METHOD(getInitialNotification: (RCTPromiseResolveBlock)resolve reject: (RCTPromiseRejectBlock)reject) {
  if (kbInitialNotification) {
    NSDictionary *notification = kbInitialNotification;
    kbInitialNotification = nil;
    resolve(notification);
  } else {
    resolve([NSNull null]);
  }
}

RCT_EXPORT_METHOD(removeAllPendingNotificationRequests) {
  UNUserNotificationCenter *current = UNUserNotificationCenter.currentNotificationCenter;
  [current removeAllPendingNotificationRequests];
}

RCT_EXPORT_METHOD(clearLocalLogs: (RCTPromiseResolveBlock)resolve reject: (RCTPromiseRejectBlock)reject) {
  FsPathsHolder *holder = [FsPathsHolder sharedFsPathsHolder];
  NSDictionary<NSString *, NSString *> *fsPaths = holder.fsPaths;
  NSString *logFilePath = fsPaths[@"logFile"];

  if (!logFilePath || logFilePath.length == 0) {
    resolve(@YES);
    return;
  }

  NSString *logDir = [logFilePath stringByDeletingLastPathComponent];
  NSFileManager *fm = [NSFileManager defaultManager];

  if (![fm fileExistsAtPath:logDir]) {
    resolve(@YES);
    return;
  }

  NSError *error = nil;
  NSArray<NSString *> *files = [fm contentsOfDirectoryAtPath:logDir error:&error];

  if (error) {
    NSLog(@"Error listing log directory: %@", error.localizedDescription);
    resolve(@YES);
    return;
  }

  for (NSString *fileName in files) {
    NSString *filePath = [logDir stringByAppendingPathComponent:fileName];
    NSFileHandle *fileHandle = [NSFileHandle fileHandleForWritingAtPath:filePath];

    if (fileHandle) {
      @try {
        [fileHandle truncateFileAtOffset:0];
        [fileHandle synchronizeFile];
        [fileHandle closeFile];
      } @catch (NSException *exception) {
        NSLog(@"Error truncating log file %@: %@", fileName, exception.reason);
      }
    }
  }

  resolve(@YES);
}

RCT_EXPORT_METHOD(addNotificationRequest: (JS::NativeKb::SpecAddNotificationRequestConfig &)config resolve: (RCTPromiseResolveBlock)resolve reject: (RCTPromiseRejectBlock)reject) {
    NSString *body = config.body();
    NSString *identifier = config.id_();

  if (!body || !identifier) {
    reject(@"invalid_config", @"body and id are required", nil);
    return;
  }

  UNMutableNotificationContent *content = [[UNMutableNotificationContent alloc] init];
  content.body = body;

  UNNotificationRequest *request = [UNNotificationRequest requestWithIdentifier:identifier content:content trigger:nil];

  UNUserNotificationCenter *current = UNUserNotificationCenter.currentNotificationCenter;
  [current addNotificationRequest:request withCompletionHandler:^(NSError * _Nullable error) {
    if (error) {
      reject(@"notification_error", error.localizedDescription, error);
    } else {
      resolve(@YES);
    }
  }];
}

+ (void)setDeviceToken:(NSString *)token {
  kbStoredDeviceToken = token;
  dispatch_async(dispatch_get_main_queue(), ^{
    Kb *instance = kbSharedInstance;
    if (instance && token && [instance canEmit]) {
      [instance emitOnPushToken:token];
    }
  });
}

+ (void)setInitialNotification:(NSDictionary *)notification {
  kbInitialNotification = notification;
}

+ (void)emitPushNotification:(NSDictionary *)notification {
  Kb *instance = kbSharedInstance;
  if (instance && [instance canEmit]) {
    [instance emitOnPushNotification:notification];
    NSLog(@"Kb.emitPushNotification: sent event 'onPushNotification' to JS");
  } else {
    NSLog(@"Kb.emitPushNotification: WARNING - module not ready, event not sent");
  }
}

- (void)handleHardwareKeyPressed:(NSNotification *)notification {
  NSString *keyName = notification.userInfo[@"pressedKey"];
  if (keyName && [self canEmit]) {
    [self emitOnHardwareKeyPressed:keyName];
  }
}

// Android-only spec methods; stubs satisfy the NativeKbSpec protocol
- (void)androidAddCompleteDownload:(JS::NativeKb::SpecAndroidAddCompleteDownloadO &)o resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {}
- (void)androidAppColorSchemeChanged:(NSString *)mode {}
- (void)androidShare:(NSString *)text mimeType:(NSString *)mimeType resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {}
- (void)androidShareText:(NSString *)text mimeType:(NSString *)mimeType resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {}
@end

@implementation UITextView (KBPasteImage)

- (BOOL)kb_canPerformAction:(SEL)action withSender:(id)sender {
  if (action == @selector(paste:) && kbPasteImageEnabled) {
    if ([UIPasteboard generalPasteboard].hasImages) {
      return YES;
    }
  }
  return [self kb_canPerformAction:action withSender:sender];
}

- (void)kb_paste:(id)sender {
  if (kbPasteImageEnabled) {
    UIPasteboard *pb = [UIPasteboard generalPasteboard];
    if (pb.hasImages) {
      NSArray<UIImage *> *images = pb.images;
      if (images.count > 0) {
        [Kb handlePastedImages:images];
        return;
      }
    }
  }

  [self kb_paste:sender];
}

@end

void KbSetDeviceToken(NSString *token) {
  [Kb setDeviceToken:token];
}

void KbSetInitialNotification(NSDictionary *notification) {
  [Kb setInitialNotification:notification];
}

void KbEmitPushNotification(NSDictionary *notification) {
  [Kb emitPushNotification:notification];
}

void KbEmitStoredNotificationOnBecomeActive(void) {
  NSDictionary *stored = kbInitialNotification;
  kbInitialNotification = nil;
  if (!stored) {
    NSLog(@"KbEmitStoredNotificationOnBecomeActive: no stored notification");
    return;
  }
  if (![stored[@"userInteraction"] boolValue]) {
    // Not from a user tap; nothing to re-emit.
    return;
  }
  if ([stored[@"reEmittedInBecomeActive"] boolValue]) {
    // Already re-emitted once; keep it stored for getInitialNotification.
    kbInitialNotification = stored;
    return;
  }
  [Kb emitPushNotification:stored];
  NSMutableDictionary *copy = [stored mutableCopy];
  copy[@"reEmittedInBecomeActive"] = @YES;
  kbInitialNotification = copy;
}
