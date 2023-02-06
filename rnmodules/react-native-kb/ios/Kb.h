#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@protocol KbProvider
- (NSDictionary *) fsPaths;
@end

@interface Kb : RCTEventEmitter <RCTBridgeModule>
- (void)setBridge:(RCTBridge *)bridge;
@property (nonatomic, assign) BOOL setBridgeOnMainQueue;
@end
