#import "Kb.h"
#import "Keybase.h"
#import <CoreTelephony/CTCarrier.h>
#import <CoreTelephony/CTTelephonyNetworkInfo.h>
#import <Foundation/Foundation.h>
#import <UserNotifications/UserNotifications.h>
#import <React/RCTEventDispatcher.h>
#import <React/RCTBridge.h>
#import <React/RCTBridge+Private.h>
#import <ReactCommon/CallInvoker.h>
#import <cstring>
#import <jsi/jsi.h>
#import <sys/utsname.h>
#import "../cpp/rpc.h"

#ifdef RCT_NEW_ARCH_ENABLED
#import "RNKbSpec.h"
#endif

using namespace facebook::jsi;
using namespace facebook;
using namespace std;

static const DDLogLevel ddLogLevel = DDLogLevelDebug;
static const NSString *tagName = @"NativeLogger";
static NSString *const eventName = @"kb-engine-event";
static NSString *const metaEventName = @"kb-meta-engine-event";
static NSString *const metaEventEngineReset = @"kb-engine-reset";

@interface RCTBridge (KB)
- (std::shared_ptr<facebook::react::CallInvoker>)jsCallInvoker;
@end

@interface Kb ()
@property dispatch_queue_t readQueue;
@property BOOL bridgeDead;
@end

@implementation Kb
@synthesize bridge = _bridge;
@synthesize methodQueue = _methodQueue;

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

- (void)invalidate
{
    [super invalidate];
    self.bridgeDead = YES;
    NSError *error = nil;
    KeybaseReset(&error);
    self.readQueue = nil;
}

static Runtime *g_jsiRuntime = nullptr;
static RCTCxxBridge *g_cxxBridge = nullptr;

// Installing JSI Bindings as done by
// https://github.com/mrousavy/react-native-mmkv
RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(installJSI) {
  RCTBridge *bridge = [RCTBridge currentBridge];
  RCTCxxBridge *cxxBridge = (RCTCxxBridge *)bridge;
  if (cxxBridge == nil) {
    return @false;
  }

  auto jsiRuntime = (Runtime *)cxxBridge.runtime;
  if (jsiRuntime == nil) {
    return @false;
  }

  g_jsiRuntime = jsiRuntime;
  g_cxxBridge = cxxBridge;
  DDLogInfo(
      @"%@%@: [%@,\"%@\"]", @"d", @"NativeLogger",
      [NSString
          stringWithFormat:@"%f", [[NSDate date] timeIntervalSince1970] * 1000],
      @"jsi install success");
  install(*(Runtime *)jsiRuntime, self);
  return @true;
}

- (void)sendToJS:(NSData *)data {
  int size = (int)[data length];
  auto values = PrepRpcOnJS(*g_jsiRuntime, (uint8_t *)[data bytes], size);
  auto invoker = [g_cxxBridge jsCallInvoker];
  invoker->invokeAsync([values]() {
    RpcOnJS(*g_jsiRuntime, values, [](const std::string &err) {
      DDLogInfo(@"%@%@: [%@,\"jsi rpconjs error: %@\"]", @"d", @"NativeLogger",
                [NSString stringWithFormat:@"%f", [[NSDate date]
                                                      timeIntervalSince1970] *
                                                      1000],
                [NSString stringWithUTF8String:err.c_str()]);
    });
  });
}

static void install(Runtime &jsiRuntime, Kb *goJSIBridge) {
  auto rpcOnGo = Function::createFromHostFunction(
      jsiRuntime, PropNameID::forAscii(jsiRuntime, "rpcOnGo"), 1,
      [goJSIBridge](Runtime &runtime, const Value &thisValue,
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
      });
  jsiRuntime.global().setProperty(jsiRuntime, "rpcOnGo", move(rpcOnGo));
}


RCT_REMAP_METHOD(getDefaultCountryCode, resolver
                 : (RCTPromiseResolveBlock)resolve rejecter
                 : (RCTPromiseRejectBlock)reject) {
  CTTelephonyNetworkInfo *network_Info = [CTTelephonyNetworkInfo new];
  CTCarrier *carrier = network_Info.subscriberCellularProvider;

  resolve(carrier.isoCountryCode);
}

RCT_REMAP_METHOD(logSend, status
                 : (NSString *)status feedback
                 : (NSString *)feedback sendLogs
                 : (BOOL)sendLogs sendMaxBytes
                 : (BOOL)sendMaxBytes traceDir
                 : (NSString *)traceDir cpuProfileDir
                 : (NSString *)cpuProfileDir resolver
                 : (RCTPromiseResolveBlock)resolve rejecter
                 : (RCTPromiseRejectBlock)reject) {

  NSString *logId = nil;
  NSError *err = nil;
  logId = KeybaseLogSend(status, feedback, sendLogs, sendMaxBytes, traceDir,
                         cpuProfileDir, &err);
  if (err == nil) {
    resolve(logId);
  } else {
    // Leave message nil so that err's message is used.
    reject(@"log_send_err", nil, err);
  }
}

RCT_REMAP_METHOD(iosGetHasShownPushPrompt, getHasShownPushPromptWithResolver
                 : (RCTPromiseResolveBlock)resolve rejecter
                 : (RCTPromiseRejectBlock)reject) {
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

RCT_REMAP_METHOD(iosLog, tagsAndLogs : (NSArray *)tagsAndLogs) {
  for (NSArray *tagAndLog in tagsAndLogs) {
    DDLogInfo(@"%@%@: %@", tagAndLog[0], tagName, tagAndLog[1]);
    // uncomment this to get logs in xcode from the js side with the native
    // logger. NSLogs don't show
    //    printf("DEBUGJS: %s\n", [tagAndLog[1] UTF8String]);
  }
}

- (void)setupLogger {
  if (self.fileLogger != nil) {
    return;
  }
  self.fileLogger = [[DDFileLogger alloc] init];
  self.fileLogger.rollingFrequency = 60 * 60 * 24;            // 24 hour rolling
  self.fileLogger.logFileManager.maximumNumberOfLogFiles = 3; // 3 days
  [DDLog addLogger:self.fileLogger];

  DDLogInfo(
      @"%@%@: [%@,\"%@\"]", @"d", @"NativeLogger",
      [NSString
          stringWithFormat:@"%f", [[NSDate date] timeIntervalSince1970] * 1000],
      @"logger setup success");
}

RCT_REMAP_METHOD(logDump, tagPrefix
                 : (NSString *)tagPrefix resolver
                 : (RCTPromiseResolveBlock)resolve rejecter
                 : (RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    [self setupLogger];
    DDFileLogger *fileLogger = self.fileLogger;

    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_LOW, 0), ^{
      NSMutableArray<NSString *> *lines = [[NSMutableArray alloc] init];
      NSArray<NSString *> *paths =
          [[fileLogger logFileManager] sortedLogFilePaths];
      for (NSString *path in paths) {
        NSString *fileContents =
            [NSString stringWithContentsOfFile:path
                                      encoding:NSUTF8StringEncoding
                                         error:NULL];
        for (NSString *line in
             [fileContents componentsSeparatedByCharactersInSet:
                               [NSCharacterSet newlineCharacterSet]]) {
          NSRange range = [line
              rangeOfString:[NSString stringWithFormat:@"%@%@: ", tagPrefix,
                                                       tagName]];
          if (range.location != NSNotFound) {
            [lines addObject:[line substringFromIndex:range.location +
                                                      range.length]];
          }
        }
      }
      resolve(lines);
    });
  });
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

- (NSString*)setupServerConfig {
  NSArray *paths = NSSearchPathForDirectoriesInDomains(NSCachesDirectory,
                                                       NSUserDomainMask, YES);
  NSString *cachePath = [paths objectAtIndex:0];
  NSString *filePath = [cachePath
      stringByAppendingPathComponent:@"/Keybase/keybase.app.serverConfig"];
  NSError *err;
  return [NSString stringWithContentsOfFile:filePath
                                                encoding:NSUTF8StringEncoding
                                                   error:&err];
}

- (NSString*)setupGuiConfig {
    id<KbProvider> kbProvider = (id<KbProvider>)[[UIApplication sharedApplication] delegate];
  NSString *filePath = [[kbProvider fsPaths][@"sharedHome"]
      stringByAppendingPathComponent:
          @"/Library/Application Support/Keybase/gui_config.json"];
  NSError *err;
  return [NSString stringWithContentsOfFile:filePath
                                             encoding:NSUTF8StringEncoding
                                                error:&err];
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
  self.bridgeDead = NO;
  dispatch_async(dispatch_get_main_queue(), ^{
    [[NSNotificationCenter defaultCenter]
     addObserver:self
     selector:@selector(engineReset)
     name:RCTJavaScriptWillStartLoadingNotification
     object:nil];
    self.readQueue = dispatch_queue_create("go_bridge_queue_read", DISPATCH_QUEUE_SERIAL);
    
    dispatch_async(self.readQueue, ^{
      while (true) {
          if (self.bridgeDead) {
              NSLog(@"Bridge dead, bailing");
              return;
          }
        NSError *error = nil;
        NSData *data = KeybaseReadArr(&error);
        if (error) {
          NSLog(@"Error reading data: %@", error);
        }
        if (data) {
          [self sendToJS:data];
        }
      }
    });
  });
}

- (NSDictionary *)constantsToExport {
  NSString * serverConfig = [self setupServerConfig];
  NSString * guiConfig = [self setupGuiConfig];

  NSString *darkModeSupported = @"0";
  if (@available(iOS 13.0, *)) {
    darkModeSupported = @"1";
  };

  NSString *appVersionString = [[NSBundle mainBundle]
      objectForInfoDictionaryKey:@"CFBundleShortVersionString"];
  NSString *appBuildString =
      [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleVersion"];
  NSLocale *currentLocale = [NSLocale currentLocale];
  NSString *cacheDir = [NSSearchPathForDirectoriesInDomains(
      NSCachesDirectory, NSUserDomainMask, YES) firstObject];
  NSString *downloadDir = [NSSearchPathForDirectoriesInDomains(
      NSDownloadsDirectory, NSUserDomainMask, YES) firstObject];

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
    @"version" : KeybaseVersion()
  };
}

- (NSArray<NSString *> *)supportedEvents {
  return @[ eventName, metaEventName ];
}

// Don't compile this code when we build for the old architecture.
#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeKbSpecJSI>(params);
}
#endif

@end
