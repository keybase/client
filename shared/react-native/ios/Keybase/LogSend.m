#import "LogSend.h"

static NSString * logPath = @"";

@implementation LogSend
+ (void)setPath:(NSString*)uiLogPath {
  logPath = uiLogPath;
}

RCT_EXPORT_MODULE();

RCT_REMAP_METHOD(logSend,
                 feedback:(NSString*)feedback
                 sendLogs:(BOOL)sendLogs
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{

  NSString *logId = nil;
  NSError *err = nil;
  NSString * appVersionString = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"];
  NSString * appBuildString = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleVersion"];

  GoKeybaseLogSend(feedback, appVersionString, appBuildString, sendLogs, logPath, &logId, &err);
  if (err == nil) {
    resolve(logId);
  } else {
    reject(@"log_send_err", @"Error in sending log", err);
  }
}

@end
