#import "LogSend.h"

static NSString * logPath = @"";

@implementation LogSend

RCT_EXPORT_MODULE();

RCT_REMAP_METHOD(logSend,
                 status:(NSString*)status
                 feedback:(NSString*)feedback
                 sendLogs:(BOOL)sendLogs
                 logPath:(NSString*)logPath
                 traceDir:(NSString*)traceDir
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{

  NSString *logId = nil;
  NSError *err = nil;
  logId = KeybaseLogSend(status, feedback, sendLogs, logPath, traceDir, &err);
  if (err == nil) {
    resolve(logId);
  } else {
    // Leave message nil so that err's message is used.
    reject(@"log_send_err", nil, err);
  }
}

@end
