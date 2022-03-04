#import <React/RCTBridgeModule.h>
#import "Engine.h"

@interface GoJSIBridge : NSObject <RCTBridgeModule>;

@property (nonatomic, assign) BOOL setBridgeOnMainQueue;
  + (void)setEngine:(Engine *)engine;
@end
