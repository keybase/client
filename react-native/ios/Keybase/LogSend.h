#import "RCTBridgeModule.h"
#import <keybase/keybase.h>

@interface LogSend : NSObject <RCTBridgeModule>
- (instancetype)initWithPath:(NSString *)uiLogPath;

@property NSString *uiLogPath;

@end