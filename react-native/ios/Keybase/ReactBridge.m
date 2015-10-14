//
//  Keybase
//
//  Created by Chris Nojima on 8/25/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import <UIKit/UIKit.h>
#import "RCTBridgeModule.h"

@interface RCT_EXTERN_MODULE(SwiftTest, NSObject)

RCT_EXTERN_METHOD(example:(NSString *)prefix callback:(RCTResponseSenderBlock)callback)

@end


@interface RCT_EXTERN_REMAP_MODULE(App, AppBridge, NSObject)

RCT_EXTERN_METHOD(getDevConfig:(RCTResponseSenderBlock)cb)
RCT_EXTERN_METHOD(setDevConfig:(NSDictionary*)newConfig)

@end