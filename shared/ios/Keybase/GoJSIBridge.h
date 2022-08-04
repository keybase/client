#import <React/RCTBridgeModule.h>
#import "Engine.h"

@interface GoJSIBridge : NSObject <RCTBridgeModule>;
  + (void)setEngine:(Engine *)engine;
  + (void)sendToJS:(NSData*)data;
@end
