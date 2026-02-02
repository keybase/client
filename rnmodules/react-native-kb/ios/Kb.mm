#import "Kb.h"
#import "Keybasego.h"
#import <CoreTelephony/CTCarrier.h>
#import <CoreTelephony/CTTelephonyNetworkInfo.h>
#import <Foundation/Foundation.h>
#import <JavaScriptCore/JavaScriptCore.h>
#import <React/RCTBridge+Private.h>
#import <React/RCTBridge.h>
#import <React/RCTEventDispatcher.h>
#import <ReactCommon/CallInvoker.h>
#import <React/RCTCallInvoker.h>
#import <UserNotifications/UserNotifications.h>
#import <cstring>
#import <jsi/jsi.h>
#import <sys/utsname.h>
#import <objc/runtime.h>
#import "./KBJSScheduler.h"
#import "RNKbSpec.h"
#import <KBCommon/KBCommon-Swift.h>

using namespace facebook::jsi;
using namespace facebook;
using namespace std;
using namespace kb;

// used to keep track of objects getting destroyed on the js side
class KBTearDown : public jsi::HostObject {
public:
  KBTearDown() { Tearup(); }
  virtual ~KBTearDown() {
    NSLog(@"KBTeardown!!!");
    Teardown();
  }
  virtual jsi::Value get(jsi::Runtime &, const jsi::PropNameID &name) {
    return jsi::Value::undefined();
  }
  virtual void set(jsi::Runtime &, const jsi::PropNameID &name, const jsi::Value &value) {}
  virtual std::vector<jsi::PropNameID> getPropertyNames(jsi::Runtime &rt) {
    return {};
  }
};

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

- (id)init {
  if (self = [super init]) {
  }
  return self;
}

- (void)dealloc {
  // Should never be called, but just here for clarity really.
}

@end

static const NSString *tagName = @"NativeLogger";
static NSString *const metaEventName = @"kb-meta-engine-event";
static NSString *const metaEventEngineReset = @"kb-engine-reset";

static __weak Kb *kbSharedInstance = nil;
static BOOL kbPasteImageEnabled = NO;
static NSString *kbStoredDeviceToken = nil;
static NSDictionary *kbInitialNotification = nil;

@interface RCTBridge (JSIRuntime)
- (void *)runtime;
@end

@interface RCTBridge (RCTTurboModule)
- (std::shared_ptr<facebook::react::CallInvoker>)jsCallInvoker;
- (void)_tryAndHandleError:(dispatch_block_t)block;
@end

@interface RCTBridge ()
- (JSGlobalContextRef)jsContextRef;
- (void *)runtime;
- (void)dispatchBlock:(dispatch_block_t)block queue:(dispatch_queue_t)queue;
@end

@interface Kb ()
@property dispatch_queue_t readQueue;
@end

@implementation Kb

jsi::Runtime *_jsRuntime;
std::shared_ptr<KBJSScheduler> jsScheduler;

// sanity check the runtime isn't out of sync due to reload etc
void *currentRuntime = nil;

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

- (instancetype)init {
  self = [super init];
  kbSharedInstance = self;
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(handleHardwareKeyPressed:)
                                               name:@"hardwareKeyPressed"
                                             object:nil];
  [Kb swizzleUITextViewPaste];
  return self;
}

+ (void)swizzleUITextViewPaste {
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    Class cls = [UITextView class];

    SEL originalPaste = @selector(paste:);
    SEL swizzledPaste = @selector(kb_paste:);
    Method originalPasteMethod = class_getInstanceMethod(cls, originalPaste);
    Method swizzledPasteMethod = class_getInstanceMethod(cls, swizzledPaste);
    method_exchangeImplementations(originalPasteMethod, swizzledPasteMethod);

    SEL originalCanPerform = @selector(canPerformAction:withSender:);
    SEL swizzledCanPerform = @selector(kb_canPerformAction:withSender:);
    Method originalCanPerformMethod = class_getInstanceMethod(cls, originalCanPerform);
    Method swizzledCanPerformMethod = class_getInstanceMethod(cls, swizzledCanPerform);
    method_exchangeImplementations(originalCanPerformMethod, swizzledCanPerformMethod);
  });
}

+ (void)handlePastedImages:(NSArray<UIImage *> *)images {
  if (!kbSharedInstance || images.count == 0) return;

  NSMutableArray *uris = [NSMutableArray array];
  for (UIImage *image in images) {
    NSData *data = UIImagePNGRepresentation(image);
    if (!data) continue;

    NSString *filename = [NSString stringWithFormat:@"paste_%@.png", [[NSUUID UUID] UUIDString]];
    NSString *tempPath = [NSTemporaryDirectory() stringByAppendingPathComponent:filename];

    if ([data writeToFile:tempPath atomically:YES]) {
      [uris addObject:tempPath];
    }
  }

  if (uris.count > 0) {
    [kbSharedInstance sendEventWithName:@"onPasteImage" body:@{@"uris": uris}];
  }
}

- (void)invalidate {
  [[NSNotificationCenter defaultCenter] removeObserver:self];
  currentRuntime = nil;
  _jsRuntime = nil;
  kbPasteImageEnabled = NO;
  [super invalidate];
  Teardown();
  self.bridge = nil;
  self.readQueue = nil;
  NSError *error = nil;
  KeybaseReset(&error);
}

- (NSArray<NSString *> *)supportedEvents {
return @[ metaEventName, @"hardwareKeyPressed", @"onPasteImage", @"onPushNotification" ];
}

RCT_EXPORT_METHOD(setEnablePasteImage:(BOOL)enabled) {
  kbPasteImageEnabled = enabled;
}

// Don't compile this code when we build for the old architecture.
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
(const facebook::react::ObjCTurboModule::InitParams &)params {
    return std::make_shared<facebook::react::NativeKbSpecJSI>(params);
}

- (void)sendToJS:(NSData *)data {
  __weak __typeof__(self) weakSelf = self;

  jsScheduler->scheduleOnJS([data, weakSelf](jsi::Runtime &jsiRuntime) {
    __typeof__(self) strongSelf = weakSelf;
    if (!strongSelf) {
      NSLog(@"Failed to find self in sendToJS invokeAsync!!!");
      return;
    }
    auto jsRuntimePtr = [strongSelf javaScriptRuntimePointer];
    if (!jsRuntimePtr) {
      NSLog(@"Failed to find jsi in sendToJS invokeAsync!!!");
      return;
    }

    int size = (int)[data length];
    if (size <= 0) {
      NSLog(@"Invalid data size in sendToJS: %d", size);
      return;
    }
    try {
        auto values = PrepRpcOnJS(jsiRuntime, (uint8_t *)[data bytes], size);
        RpcOnJS(jsiRuntime, values, [](const std::string &err) {
        KeybaseLogToService([NSString
            stringWithFormat:@"dNativeLogger: [%f,\"jsi rpconjs error: %@\"]",
                            [[NSDate date] timeIntervalSince1970] * 1000,
                            [NSString stringWithUTF8String:err.c_str()]]);
        });
    } catch (const std::exception &e) {
      NSLog(@"Exception in sendToJS msgpack processing: %s", e.what());
      KeybaseLogToService([NSString
          stringWithFormat:@"dNativeLogger: [%f,\"sendToJS unknown exception\"]",
                           [[NSDate date] timeIntervalSince1970] * 1000]);
    }
  });
}

- (jsi::Runtime *)javaScriptRuntimePointer {
    return _jsRuntime;
}

// from react-native-localize
- (bool)uses24HourClockForLocale:(NSLocale *_Nonnull)locale {
  NSDateFormatter *formatter = [NSDateFormatter new];

  [formatter setLocale:locale];
  [formatter setTimeZone:[NSTimeZone timeZoneForSecondsFromGMT:0]];
  [formatter setDateStyle:NSDateFormatterNoStyle];
  [formatter setTimeStyle:NSDateFormatterShortStyle];

  NSDate *date = [NSDate dateWithTimeIntervalSince1970:72000];
  return [[formatter stringFromDate:date] containsString:@"20"];
}

- (NSString *)setupServerConfig {
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

- (NSString *)setupGuiConfig {
  NSString *filePath = [[[FsPathsHolder sharedFsPathsHolder] fsPaths][@"sharedHome"]
          stringByAppendingPathComponent: @"/Library/Application Support/Keybase/gui_config.json"];
  NSError *err;
  NSString *val = [NSString stringWithContentsOfFile:filePath encoding:NSUTF8StringEncoding error:&err];
  if (err != nil || val == nil) {
    return @"";
  }
  return val;
}

 - (NSDictionary *)getConstants {
     return @{};
 }

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(getTypedConstants) {
  NSString *serverConfig = [self setupServerConfig];
  NSString *guiConfig = [self setupGuiConfig];

  // Dark mode available since iOS 13.0; app targets iOS 15.1+
  NSString *darkModeSupported = @"1";

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
  return @{
    @"androidIsDeviceSecure" : @NO,
    @"androidIsTestDevice" : @NO,
    @"appVersionCode" : appBuildString,
    @"appVersionName" : appVersionString,
    @"darkModeSupported" : darkModeSupported,
    @"fsCacheDir" : cacheDir,
    @"fsDownloadDir" : downloadDir,
    @"guiConfig" : guiConfig,
    @"serverConfig" : serverConfig,
    @"uses24HourClock" : @([self uses24HourClockForLocale:currentLocale]),
    @"version" : kbVersion
  };
}

RCT_EXPORT_METHOD(shareListenersRegistered) {
}

RCT_EXPORT_METHOD(engineReset) {
  NSError *error = nil;
  KeybaseReset(&error);
  [self sendEventWithName:metaEventName body:metaEventEngineReset];
  if (error) {
    NSLog(@"Error in reset: %@", error);
  }
}

RCT_EXPORT_METHOD(notifyJSReady) {
  __weak __typeof__(self) weakSelf = self;

  dispatch_async(dispatch_get_main_queue(), ^{
    // Setup infrastructure
    [[NSNotificationCenter defaultCenter]
        addObserver:self
           selector:@selector(engineReset)
               name:RCTJavaScriptWillStartLoadingNotification
             object:nil];
    self.readQueue = dispatch_queue_create("go_bridge_queue_read", DISPATCH_QUEUE_SERIAL);

    // Signal to Go that JS is ready
    KeybaseNotifyJSReady();
    NSLog(@"Notified Go that JS is ready, starting ReadArr loop");

    // Start the read loop
    dispatch_async(self.readQueue, ^{
      while (true) {
        {
          __typeof__(self) strongSelf = weakSelf;
          if (!strongSelf || !strongSelf.bridge) {
            NSLog(@"Bridge dead, bailing from ReadArr loop");
            return;
          }
        }

        NSError *error = nil;
        NSData *data = KeybaseReadArr(&error);
        if (error) {
          NSLog(@"Error reading data: %@", error);
        } else if (data) {
          __typeof__(self) strongSelf = weakSelf;
          if (strongSelf) {
            [strongSelf sendToJS:data];
          }
        }
      }
    });
  });
}

@synthesize callInvoker = _callInvoker;

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(install) {
    RCTCxxBridge *cxxBridge = (RCTCxxBridge *)self.bridge;
    _jsRuntime = (jsi::Runtime *)cxxBridge.runtime;
    auto &rnRuntime = *(jsi::Runtime *)cxxBridge.runtime;
    jsScheduler = std::make_shared<KBJSScheduler>(rnRuntime, _callInvoker.callInvoker);

    // stash the current runtime to keep in sync
    auto rpcOnGoWrap = [](Runtime &runtime, const Value &thisValue, const Value *arguments, size_t count) -> Value {
        return RpcOnGo(runtime, thisValue, arguments, count, [](void *ptr, size_t size) {
            NSData *result = [NSData dataWithBytesNoCopy:ptr length:size freeWhenDone:NO];
            NSError *error = nil;
            KeybaseWriteArr(result, &error);
            if (error) {
                NSLog(@"Error writing data: %@", error);
            }
        });
    };

    KeybaseLogToService([NSString stringWithFormat:@"dNativeLogger: [%f,\"jsi install success\"]",
                         [[NSDate date] timeIntervalSince1970] * 1000]);

    _jsRuntime->global().setProperty(*_jsRuntime, "rpcOnGo",
    Function::createFromHostFunction(*_jsRuntime, PropNameID::forAscii(*_jsRuntime, "rpcOnGo"), 1, std::move(rpcOnGoWrap)));

    // register a global so we get notified when the runtime is killed so we can
    // cleanup
    _jsRuntime->global().setProperty(*_jsRuntime, "kbTeardown", jsi::Object::createFromHostObject(*_jsRuntime, std::make_shared<KBTearDown>()));
    return @YES;
}

RCT_EXPORT_METHOD(getDefaultCountryCode
                 : (RCTPromiseResolveBlock)resolve reject
                 : (RCTPromiseRejectBlock)reject) {
  CTTelephonyNetworkInfo *network_Info = [CTTelephonyNetworkInfo new];
    // TODO this will stop working at some point
  CTCarrier *carrier = network_Info.subscriberCellularProvider;
  resolve(carrier.isoCountryCode);
}

RCT_EXPORT_METHOD(logSend:(NSString *)status feedback:(NSString *)feedback sendLogs:(BOOL)sendLogs sendMaxBytes:(BOOL)sendMaxBytes traceDir:(NSString *)traceDir cpuProfileDir:(NSString *)cpuProfileDir resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  NSString *logId = nil;
  NSError *err = nil;
  logId = KeybaseLogSend(status, feedback, sendLogs, sendMaxBytes, traceDir, cpuProfileDir, &err);
  if (err == nil) {
    resolve(logId);
  } else {
    resolve(@"");
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
    resolve(kbInitialNotification);
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

/*
RCT_EXPORT_METHOD(processVideo:(NSString *)path resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  NSURL * videoURL = [NSURL URLWithString:path];

  [MediaUtils processVideoFromOriginal:videoURL completion:^(NSError * _Nullable error, NSURL * _Nullable processedURL) {
    if (error) {
      reject(@"compression_error", error.localizedDescription, error);
    } else if (processedURL) {
      resolve(processedURL.path);
    } else {
      reject(@"compression_error", @"No processed video URL returned", nil);
    }
  }];
}
*/

+ (void)setDeviceToken:(NSString *)token {
  kbStoredDeviceToken = token;
}

+ (void)setInitialNotification:(NSDictionary *)notification {
  kbInitialNotification = notification;
}

+ (void)emitPushNotification:(NSDictionary *)notification {
  NSString *type = notification[@"type"] ?: @"unknown";
  NSString *convID = notification[@"convID"] ?: notification[@"c"] ?: @"unknown";
  NSNumber *userInteraction = notification[@"userInteraction"];

  if (kbSharedInstance) {
    [kbSharedInstance sendEventWithName:@"onPushNotification" body:notification];
    NSLog(@"Kb.emitPushNotification: sent event 'onPushNotification' to JS");
  } else {
    NSLog(@"Kb.emitPushNotification: WARNING - kbSharedInstance is nil, event not sent");
  }
}

- (void)handleHardwareKeyPressed:(NSNotification *)notification {
  NSString *keyName = notification.userInfo[@"pressedKey"];
  if (keyName) {
    NSDictionary *event = @{@"pressedKey": keyName};
    [self sendEventWithName:@"hardwareKeyPressed" body:event];
  }
}

RCT_EXPORT_METHOD(keyPressed:(NSString *)keyName) {
  NSDictionary *event = @{@"pressedKey": keyName};
  [self sendEventWithName:@"hardwareKeyPressed" body:event];
}

- (NSNumber *)androidCheckPushPermissions {return @-1;}
- (NSNumber *)androidGetSecureFlagSetting {return @-1;}
- (NSNumber *)androidRequestPushPermissions {return @-1;}
- (NSNumber *)androidSetSecureFlagSetting:(BOOL)s {return @-1;}
- (NSNumber *)androidShare:(NSString *)text mimeType:(NSString *)mimeType {return @-1;}
- (NSNumber *)androidShareText:(NSString *)text mimeType:(NSString *)mimeType {return @-1;}
- (NSString *)androidGetRegistrationToken {return @"";}
- (void)androidAddCompleteDownload:(/*JS::NativeKb::SpecAndroidAddCompleteDownloadO &*/id)o resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {}
- (void)androidAppColorSchemeChanged:(NSString *)mode {}
- (void)androidCheckPushPermissions:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {}
- (void)androidGetRegistrationToken:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {}
- (void)androidGetSecureFlagSetting:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {}
- (void)androidOpenSettings {}
- (void)androidRequestPushPermissions:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject{}
- (void)androidSetApplicationIconBadgeNumber:(double)n {}
- (void)androidSetSecureFlagSetting:(BOOL)s resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {}
- (void)androidShare:(NSString *)text mimeType:(NSString *)mimeType resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {}
- (void)androidShareText:(NSString *)text mimeType:(NSString *)mimeType resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {}
- (void)androidUnlink:(NSString *)path resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {}
- (void)androidUnlink:(NSString *)path {}

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

NSDictionary *KbGetAndClearInitialNotification(void) {
  NSDictionary *notification = kbInitialNotification;
  kbInitialNotification = nil;
  return notification;
}
