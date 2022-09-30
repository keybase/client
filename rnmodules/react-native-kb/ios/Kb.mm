#import "Kb.h"
#import "Keybase.h"
#import <CoreTelephony/CTCarrier.h>
#import <CoreTelephony/CTTelephonyNetworkInfo.h>
#import <Foundation/Foundation.h>
#import <UserNotifications/UserNotifications.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import "RNKbSpec.h"
#endif

static const DDLogLevel ddLogLevel = DDLogLevelDebug;
static const NSString *tagName = @"NativeLogger";

@implementation Kb
RCT_EXPORT_MODULE()

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
  NSString *filePath = [[kbProvider sharedHome]
      stringByAppendingPathComponent:
          @"/Library/Application Support/Keybase/gui_config.json"];
  NSError *err;
  return [NSString stringWithContentsOfFile:filePath
                                             encoding:NSUTF8StringEncoding
                                                error:&err];
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

// Don't compile this code when we build for the old architecture.
#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeKbSpecJSI>(params);
}
#endif

@end
