#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import "CocoaLumberjack.h"

@protocol KbProvider
- (NSDictionary *) fsPaths;
@end

@interface Kb : RCTEventEmitter <RCTBridgeModule>
@property (nonatomic, strong) DDFileLogger *fileLogger;
@end
