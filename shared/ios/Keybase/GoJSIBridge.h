#import <React/RCTBridgeModule.h>

@interface GoJSIBridge : NSObject <RCTBridgeModule>;

@property (nonatomic, assign) BOOL setBridgeOnMainQueue;
  + (void)sendToJS:(NSData*)data;
@end
