//
//  Engine.m
//  Keybase
//
//  Created by Chris Nojima on 8/28/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "Engine.h"

#import "AppDelegate.h"
#import "GoJSIBridge.h"
#import <React/RCTEventDispatcher.h>
#import <keybase/keybase.h>

static NSString *const eventName = @"kb-engine-event";
static NSString *const metaEventName = @"kb-meta-engine-event";
static NSString *const metaEventEngineReset = @"kb-engine-reset";

@interface KeybaseEngine ()
@property dispatch_queue_t readQueue;
@end

@implementation KeybaseEngine

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (NSArray<NSString *> *)supportedEvents {
  return @[ eventName, metaEventName ];
}

- (void)onRNReload {
  [self reset];
}

RCT_EXPORT_METHOD(reset) {
  NSError *error = nil;
  KeybaseReset(&error);
  [self sendEventWithName:metaEventName body:metaEventEngineReset];
  if (error) {
    NSLog(@"Error in reset: %@", error);
  }
}

RCT_EXPORT_METHOD(start) {
  dispatch_async(dispatch_get_main_queue(), ^{
    [[NSNotificationCenter defaultCenter]
     addObserver:self
     selector:@selector(onRNReload)
     name:RCTJavaScriptWillStartLoadingNotification
     object:nil];
    self.readQueue = dispatch_queue_create("go_bridge_queue_read", DISPATCH_QUEUE_SERIAL);
    
    dispatch_async(self.readQueue, ^{
      while (true) {
        NSError *error = nil;
        NSData *data = KeybaseReadArr(&error);
        if (error) {
          NSLog(@"Error reading data: %@", error);
        }
        if (data) {
          [GoJSIBridge sendToJS:data];
        }
      }
    });
  });
}

@end
