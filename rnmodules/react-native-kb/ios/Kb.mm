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

// Don't compile this code when we build for the old architecture.
#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeKbSpecJSI>(params);
}
#endif

@end
