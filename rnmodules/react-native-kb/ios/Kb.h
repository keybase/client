#import <React/RCTBridgeModule.h>
#import "CocoaLumberjack.h"

@interface Kb : NSObject <RCTBridgeModule>
@property (nonatomic, strong) DDFileLogger *fileLogger;
@end
