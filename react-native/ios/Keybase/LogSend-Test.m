#import "LogSend.h"

@implementation LogSend

- (instancetype)initWithPath:(NSString *)uiLogPath {
  if ((self = [super init])) {
  }
  return self;
}

RCT_EXPORT_MODULE();

RCT_REMAP_METHOD(logSend,
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
    resolve(nil);
}

@end