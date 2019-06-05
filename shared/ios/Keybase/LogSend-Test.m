#import "RCTBridgeModule.h"

@interface LogSend : NSObject <RCTBridgeModule>
- (instancetype)initWithPath:(NSString *)uiLogPath;

@end


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