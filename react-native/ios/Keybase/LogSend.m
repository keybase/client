#import "LogSend.h"

@implementation LogSend

- (instancetype)initWithPath:(NSString *)uiLogPath {
  if ((self = [super init])) {
    self.uiLogPath = uiLogPath;
  }
  return self;
}

RCT_EXPORT_MODULE();

RCT_REMAP_METHOD(logSend,
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{

  NSString *logId = nil;
  NSError *err = nil;
  GoKeybaseLogSend(self.uiLogPath, &logId, &err);
  if (err == nil) {
    resolve(logId);
  } else {
    reject(@"log_send_err", @"Error in sending log", err);
  }
}

@end