//
//  Engine.m
//  Keybase
//
//  Created by Chris Nojima on 8/28/15.
//  Copyright (c) 2017 Keybase. All rights reserved.
//

#import "RCTEventDispatcher.h"

#pragma mark - Fake engine

static NSString *const eventName = @"objc-engine-event";

@interface ObjcEngine : NSObject <RCTBridgeModule>
@end

@implementation ObjcEngine

RCT_EXPORT_MODULE();

// required by reactnative
@synthesize bridge = _bridge;

RCT_EXPORT_METHOD(runWithData:(NSString *)data) {
}

RCT_EXPORT_METHOD(reset) {
}

- (NSDictionary *)constantsToExport {
  return @{ @"eventName": eventName, @"test": @"1" };
}

@end
