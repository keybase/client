#import <React/RCTBridgeModule.h>
#import "CocoaLumberjack.h"

@protocol KbProvider
- (NSString *) sharedHome;
@end

@interface Kb : NSObject <RCTBridgeModule>
@property (nonatomic, strong) DDFileLogger *fileLogger;
@end
