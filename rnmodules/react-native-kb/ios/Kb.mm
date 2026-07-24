#import "Kb.h"
#import "Keybasego.h"
#import <Foundation/Foundation.h>
#import <React/RCTEventDispatcher.h>
#import <ReactCommon/CallInvoker.h>
#import <React/RCTCallInvoker.h>
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

static void kbSetBridge(std::shared_ptr<kb::KBBridge> bridge) {
  std::shared_ptr<kb::KBBridge> old;
  {
    std::lock_guard<std::mutex> lock(kbBridgeMutex);
    old = std::move(kbCurrentBridge);
    kbCurrentBridge = std::move(bridge);
  }
  // markTornDown only flips an atomic; releasing the old bridge's jsi handles
  // is the JS runtime's job (see the kbTeardown host object).
  if (old) {
    old->markTornDown();
  }
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

@implementation Kb

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
  kbSharedInstance = self;
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
  // Drop the bridge so the (permanent) reader thread stops delivering into a
  // runtime that is going away. Only the atomic flag is touched here: this
  // runs on the main thread, and releasing jsi handles off the JS thread is
  // undefined behavior.
  kbSetBridge(nullptr);
  NSError *error = nil;
  KeybaseReset(&error);
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
        []() {
            kbLogToService(@"rpc stream desync, resetting connection");
            NSError *error = nil;
            KeybaseReset(&error);
            if (error) {
                kbLogToService([NSString stringWithFormat:@"reset after desync failed: %@",
                                                          error.localizedDescription]);
            }
            dispatch_async(dispatch_get_main_queue(), ^{
                Kb *instance = kbSharedInstance;
                if (instance && [instance canEmit]) {
                    [instance emitOnMetaEvent:metaEventEngineReset];
                }
            });
        });

    kbSetBridge(bridge);
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

RCT_EXPORT_METHOD(engineReset) {
  NSError *error = nil;
  KeybaseReset(&error);
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

      while (true) {
        NSError *error = nil;
        NSData *data = KeybaseReadArr(&error);
        if (error) {
          NSLog(@"Error reading data: %@", error);
          [NSThread sleepForTimeInterval:0.1];
          continue;
        }
        if (data.length == 0) {
          // ReadArr returns (nil, nil) when the connection had nothing for
          // us; without a pause this spins a core at full speed.
          [NSThread sleepForTimeInterval:0.01];
          continue;
        }
        auto bridge = kbGetBridge();
        if (bridge) {
          bridge->onDataFromGo((uint8_t *)[data bytes], (int)[data length]);
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
