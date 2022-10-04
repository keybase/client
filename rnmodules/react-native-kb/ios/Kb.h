#import <React/RCTBridgeModule.h>
#import "CocoaLumberjack.h"

@protocol KbProvider
- (NSDictionary *) fsPaths;
@end

@interface Kb : NSObject <RCTBridgeModule>
@property (nonatomic, strong) DDFileLogger *fileLogger;
@end
