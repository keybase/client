#import "RCTBridgeModule.h"
#import <keybase/keybase.h>

@interface LogSend : NSObject <RCTBridgeModule>
+ (void)setPath:(NSString*)uiLogPath;
@end
