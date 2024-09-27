#import "Kb.h"
#import "Keybase.h"
#import <CoreTelephony/CTCarrier.h>
#import <CoreTelephony/CTTelephonyNetworkInfo.h>
#import <Foundation/Foundation.h>
#import <JavaScriptCore/JavaScriptCore.h>
#import <React/RCTBridge+Private.h>
#import <React/RCTBridge.h>
#import <React/RCTEventDispatcher.h>
#import <ReactCommon/CallInvoker.h>
#import <UserNotifications/UserNotifications.h>
#import <cstring>
#import <jsi/jsi.h>
#import <sys/utsname.h>
#import "./KBJSScheduler.h"

#ifdef RCT_NEW_ARCH_ENABLED
#import "RNKbSpec.h"
#endif

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
  virtual void set(jsi::Runtime &, const jsi::PropNameID &name,
                   const jsi::Value &value) {}
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
  if (self) {
  }
  return self;
}

- (void)invalidate {
  currentRuntime = nil;
  _jsRuntime = nil;
  [super invalidate];
  Teardown();
  self.bridge = nil;
  self.readQueue = nil;
  NSError *error = nil;
  KeybaseReset(&error);
}

- (NSArray<NSString *> *)supportedEvents {
return @[ metaEventName ];
}

// Don't compile this code when we build for the old architecture.
#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
(const facebook::react::ObjCTurboModule::InitParams &)params {
return std::make_shared<facebook::react::NativeKbSpecJSI>(params);
}
#endif

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
    auto values = PrepRpcOnJS(jsiRuntime, (uint8_t *)[data bytes], size);

    RpcOnJS(jsiRuntime, values, [](const std::string &err) {
      KeybaseLogToService([NSString
          stringWithFormat:@"dNativeLogger: [%f,\"jsi rpconjs error: %@\"]",
                           [[NSDate date] timeIntervalSince1970] * 1000,
                           [NSString stringWithUTF8String:err.c_str()]]);
    });
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
  NSArray *paths = NSSearchPathForDirectoriesInDomains(NSCachesDirectory,
                                                       NSUserDomainMask, YES);
  NSString *cachePath = [paths objectAtIndex:0];
  NSString *filePath = [cachePath
      stringByAppendingPathComponent:@"/Keybase/keybase.app.serverConfig"];
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
  NSString *filePath =
      [[[FsPathsHolder sharedFsPathsHolder] fsPaths][@"sharedHome"]
          stringByAppendingPathComponent:
              @"/Library/Application Support/Keybase/gui_config.json"];
  NSError *err;
  NSString *val = [NSString stringWithContentsOfFile:filePath
                                            encoding:NSUTF8StringEncoding
                                               error:&err];
  if (err != nil || val == nil) {
    return @"";
  }
  return val;
}

- (NSDictionary *)getConstants {
  return [self constantsToExport];
}

- (NSDictionary *)constantsToExport {
  NSString *serverConfig = [self setupServerConfig];
  NSString *guiConfig = [self setupGuiConfig];

  NSString *darkModeSupported = @"0";
  if (@available(iOS 13.0, *)) {
    darkModeSupported = @"1";
  };

  NSString *appVersionString = [[NSBundle mainBundle]
      objectForInfoDictionaryKey:@"CFBundleShortVersionString"];
  if (appVersionString == nil) {
    appVersionString = @"";
  }
  NSString *appBuildString =
      [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleVersion"];
  if (appBuildString == nil) {
    appBuildString = @"";
  }
  NSLocale *currentLocale = [NSLocale currentLocale];
  NSString *cacheDir = [NSSearchPathForDirectoriesInDomains(
      NSCachesDirectory, NSUserDomainMask, YES) firstObject];
  NSString *downloadDir = [NSSearchPathForDirectoriesInDomains(
      NSDownloadsDirectory, NSUserDomainMask, YES) firstObject];

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

RCT_EXPORT_METHOD(engineReset) {
  NSError *error = nil;
  KeybaseReset(&error);
  [self sendEventWithName:metaEventName body:metaEventEngineReset];
  if (error) {
    NSLog(@"Error in reset: %@", error);
  }
}

RCT_EXPORT_METHOD(engineStart) {
  __weak __typeof__(self) weakSelf = self;

  dispatch_async(dispatch_get_main_queue(), ^{
    [[NSNotificationCenter defaultCenter]
        addObserver:self
           selector:@selector(engineReset)
               name:RCTJavaScriptWillStartLoadingNotification
             object:nil];
    self.readQueue =
        dispatch_queue_create("go_bridge_queue_read", DISPATCH_QUEUE_SERIAL);

    dispatch_async(self.readQueue, ^{
      while (true) {
        {
          __typeof__(self) strongSelf = weakSelf;
          if (!strongSelf || !strongSelf.bridge) {
            NSLog(@"Bridge dead, bailing");
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

BOOL isBridgeless = false; // SYNC with AppDelegate.mm

#if defined(RCT_NEW_ARCH_ENABLED)
@synthesize runtimeExecutor = _runtimeExecutor;
#endif

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(install) {
    if (isBridgeless) {
#if defined(RCT_NEW_ARCH_ENABLED)
        RCTCxxBridge *cxxBridge = (RCTCxxBridge *)self.bridge;
        _jsRuntime = (jsi::Runtime *)cxxBridge.runtime;
        auto &rnRuntime = *(jsi::Runtime *)cxxBridge.runtime;
        auto executorFunction = ([executor = _runtimeExecutor](std::function<void(jsi::Runtime & runtime)> &&callback) {
            // Convert to Objective-C block so it can be captured properly.
            __block auto callbackBlock = callback;
            
            [executor execute:^(jsi::Runtime &runtime) {
                callbackBlock(runtime);
            }];
        });
        jsScheduler = std::make_shared<KBJSScheduler>(rnRuntime, executorFunction);
#else // (RCT_NEW_ARCH_ENABLED)
        [NSException raise:@"Missing bridge" format:@"Failed to obtain the bridge."];
#endif
    } else {
        _jsRuntime = [self.bridge respondsToSelector:@selector(runtime)]
        ? reinterpret_cast<facebook::jsi::Runtime *>(self.bridge.runtime)
        : nullptr;
        jsScheduler = std::make_shared<KBJSScheduler>(*_jsRuntime, self.bridge.jsCallInvoker);
    }
    
    // stash the current runtime to keep in sync
    auto rpcOnGoWrap = [](Runtime &runtime, const Value &thisValue,
                          const Value *arguments, size_t count) -> Value {
        return RpcOnGo(runtime, thisValue, arguments, count,
                       [](void *ptr, size_t size) {
            NSData *result = [NSData dataWithBytesNoCopy:ptr
                                                  length:size
                                            freeWhenDone:NO];
            NSError *error = nil;
            KeybaseWriteArr(result, &error);
            if (error) {
                NSLog(@"Error writing data: %@", error);
            }
        });
    };
    
    KeybaseLogToService(
                        [NSString stringWithFormat:@"dNativeLogger: [%f,\"jsi install success\"]",
                         [[NSDate date] timeIntervalSince1970] * 1000]);
    
    _jsRuntime->global().setProperty(
                                     *_jsRuntime, "rpcOnGo",
                                     Function::createFromHostFunction(
                                                                      *_jsRuntime, PropNameID::forAscii(*_jsRuntime, "rpcOnGo"), 1,
                                                                      std::move(rpcOnGoWrap)));
    
    // register a global so we get notified when the runtime is killed so we can
    // cleanup
    _jsRuntime->global().setProperty(
                                     *_jsRuntime, "kbTeardown",
                                     jsi::Object::createFromHostObject(*_jsRuntime,
                                                                       std::make_shared<KBTearDown>()));
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
  logId = KeybaseLogSend(status, feedback, sendLogs, sendMaxBytes, traceDir,
                         cpuProfileDir, &err);
  if (err == nil) {
    resolve(logId);
  } else {
    resolve(@"");
  }
}

RCT_EXPORT_METHOD(iosGetHasShownPushPrompt: (RCTPromiseResolveBlock)resolve reject: (RCTPromiseRejectBlock)reject) {
  UNUserNotificationCenter *current =
      UNUserNotificationCenter.currentNotificationCenter;
  [current getNotificationSettingsWithCompletionHandler:^(
               UNNotificationSettings *_Nonnull settings) {
    if (settings.authorizationStatus == UNAuthorizationStatusNotDetermined) {
      // We haven't asked yet
      resolve(@FALSE);
      return;
    }
    resolve(@TRUE);
    return;
  }];
}

- (NSNumber *)androidCheckPushPermissions {return @-1;}
- (NSNumber *)androidGetSecureFlagSetting {return @-1;}
- (NSNumber *)androidRequestPushPermissions {return @-1;}
- (NSNumber *)androidSetSecureFlagSetting:(BOOL)s {return @-1;}
- (NSNumber *)androidShare:(NSString *)text mimeType:(NSString *)mimeType {return @-1;}
- (NSNumber *)androidShareText:(NSString *)text mimeType:(NSString *)mimeType {return @-1;}
- (NSString *)androidGetInitialBundleFromNotification {return @"";}
- (NSString *)androidGetInitialShareFileUrl {return @"";}
- (NSString *)androidGetInitialShareText {return @"";}
- (NSString *)androidGetRegistrationToken {return @"";}
- (void)androidAddCompleteDownload:(/*JS::NativeKb::SpecAndroidAddCompleteDownloadO &*/id)o resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {}
- (void)androidAppColorSchemeChanged:(NSString *)mode {}
- (void)androidCheckPushPermissions:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {}
- (void)androidGetInitialBundleFromNotification:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {}
- (void)androidGetInitialShareFileUrls:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {}
- (void)androidGetInitialShareText:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {}
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
