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

// singleton so the exported react component can get it
static Engine *sharedEngine = nil;

@interface Engine ()

@property dispatch_queue_t readQueue;
@property(strong) KeybaseEngine *keybaseEngine;

- (void)start:(KeybaseEngine *)emitter;
- (void)startReadLoop;
- (void)setupQueues;
- (void)reset;
- (void)onRNReload;

@end

@implementation Engine

static NSString *const eventName = @"kb-engine-event";
static NSString *const metaEventName = @"kb-meta-engine-event";
static NSString *const metaEventEngineReset = @"kb-engine-reset";

- (instancetype)initWithSettings:(NSDictionary *)settings
                           error:(NSError **)error {
  if ((self = [super init])) {
    sharedEngine = self;
    self.sharedHome = settings[@"sharedHome"];
    [GoJSIBridge setEngine:self];
    [[NSNotificationCenter defaultCenter]
        addObserver:self
           selector:@selector(onRNReload)
               name:RCTJavaScriptWillStartLoadingNotification
             object:nil];
    [self setupQueues];
    [self setupKeybaseWithSettings:settings error:error];
  }
  return self;
}

// Reload Go if we reload the JS
- (void)onRNReload {
  self.keybaseEngine = nil;
  [self reset];
}

- (void)setupKeybaseWithSettings:(NSDictionary *)settings
                           error:(NSError **)error {
  NSString *systemVer = [[UIDevice currentDevice] systemVersion];
  BOOL isIPad =
      [[UIDevice currentDevice] userInterfaceIdiom] == UIUserInterfaceIdiomPad;
  BOOL isIOS = YES;
  KeybaseInit(settings[@"homedir"], settings[@"sharedHome"],
              settings[@"logFile"], settings[@"runmode"],
              settings[@"SecurityAccessGroupOverride"], NULL, NULL, systemVer,
              isIPad, NULL, isIOS, error);
}

- (void)setupQueues {
  self.readQueue =
      dispatch_queue_create("go_bridge_queue_read", DISPATCH_QUEUE_SERIAL);
}

- (void)startReadLoop {
  dispatch_async(self.readQueue, ^{
    while (true) {
      NSError *error = nil;
      NSData *data = KeybaseReadArr(&error);
      if (error) {
        NSLog(@"Error reading data: %@", error);
      }
      if (data) {
        if (!self.keybaseEngine) {
          NSLog(@"NO ENGINE");
        }
        [GoJSIBridge sendToJS:data];
      }
    }
  });
}

- (void)start:(KeybaseEngine *)emitter {
  self.keybaseEngine = emitter;
  [self startReadLoop];
}

- (void)rpcToGo:(NSData *)data {
  NSError *error = nil;
  KeybaseWriteArr(data, &error);
  if (error) {
    NSLog(@"Error writing data: %@", error);
  }
}

- (void)reset {
  NSError *error = nil;
  KeybaseReset(&error);
  [self.keybaseEngine sendEventWithName:metaEventName
                                   body:metaEventEngineReset];
  if (error) {
    NSLog(@"Error in reset: %@", error);
  }
}

@end

#pragma mark - Engine exposed to react

@interface KeybaseEngine ()
@end

@implementation KeybaseEngine

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (NSArray<NSString *> *)supportedEvents {
  return @[ eventName, metaEventName ];
}

RCT_EXPORT_METHOD(reset) { [sharedEngine reset]; }

RCT_EXPORT_METHOD(start) { [sharedEngine start:self]; }

@end
