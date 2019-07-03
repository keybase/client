#import "LogSend.h"

static NSString * logPath = @"";

@implementation LogSend

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_REMAP_METHOD(logSend,
                 status:(NSString*)status
                 feedback:(NSString*)feedback
                 sendLogs:(BOOL)sendLogs
                 sendMaxBytes:(BOOL)sendMaxBytes
                 logPath:(NSString*)logPath
                 traceDir:(NSString*)traceDir
                 cpuProfileDir:(NSString*)cpuProfileDir
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{

  NSString *logId = nil;
  NSError *err = nil;
  logId = KeybaseLogSend(status, feedback, sendLogs, sendMaxBytes, logPath, traceDir, cpuProfileDir, &err);
  if (err == nil) {
    resolve(logId);
  } else {
    // Leave message nil so that err's message is used.
    reject(@"log_send_err", nil, err);
  }
}

@end
