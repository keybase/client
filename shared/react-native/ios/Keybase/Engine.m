//
//  Engine.m
//  Keybase
//
//  Created by Chris Nojima on 8/28/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "Engine.h"

#import <keybase/keybase.h>
#import "RCTEventDispatcher.h"
#import "AppDelegate.h"
#import "Utils.h"

@interface Engine ()

@property dispatch_queue_t readQueue;
@property dispatch_queue_t writeQueue;
@property (strong) RCTBridge *bridge;

- (void)startReadLoop;
- (void)setupQueues;
- (void)runWithData:(NSString *)data;
- (void)reset;

@end

@implementation Engine

static NSString *const eventName = @"objc-engine-event";

- (instancetype)initWithSettings:(NSDictionary *)settings error:(NSError **)error {
  if ((self = [super init])) {
    [self setupKeybaseWithSettings:settings error:error];
    [self setupQueues];
    [self startReadLoop];
  }
  return self;
}

- (void)setupKeybaseWithSettings:(NSDictionary *)settings error:(NSError **)error {
  GoKeybaseInit(settings[@"homedir"], settings[@"logFile"], settings[@"runmode"], settings[@"SecurityAccessGroupOverride"], error);
}

- (void)setupQueues {
  self.readQueue = dispatch_queue_create("go_bridge_queue_read", DISPATCH_QUEUE_SERIAL);
  self.writeQueue = dispatch_queue_create("go_bridge_queue_write", DISPATCH_QUEUE_SERIAL);
}

- (void)startReadLoop {
  dispatch_async(self.readQueue, ^{
    while (true) {
      NSError *error = nil;
      NSString *data = nil;
      GoKeybaseReadB64(&data, &error);
      if (error) {
        NSLog(@"Error reading data: %@", error);
      }
      if (data) {
        [self.bridge.eventDispatcher sendAppEventWithName:eventName body:data];
      }
    }
  });
}

- (void)runWithData:(NSString *)data {
  dispatch_async(self.writeQueue, ^{
    NSError *error = nil;
    GoKeybaseWriteB64(data, &error);
    if (error) {
      NSLog(@"Error writing data: %@", error);
    }
  });
}

- (void)reset {
  NSError *error = nil;
  GoKeybaseReset(&error);
  if (error) {
    NSLog(@"Error in reset: %@", error);
  }
}

@end

#pragma mark - Engine exposed to react

@interface ObjcEngine : NSObject <RCTBridgeModule>
@property (readonly) Engine* engine;
@end

@implementation ObjcEngine

RCT_EXPORT_MODULE();

// required by reactnative
@synthesize bridge = _bridge;

- (Engine *)engine {
  AppDelegate * delegate = (AppDelegate*)[UIApplication sharedApplication].delegate;
  return delegate.engine;
}

RCT_EXPORT_METHOD(runWithData:(NSString *)data) {
  Engine * engine = self.engine;
  engine.bridge = self.bridge;
  [self.engine runWithData: data];
}

RCT_EXPORT_METHOD(reset) {
  [self.engine reset];
}

- (NSDictionary *)constantsToExport {
  NSString * testVal = [Utils areWeBeingUnitTested] ? @"1" : @"";
  NSString * simulatorVal =
#if TARGET_IPHONE_SIMULATOR
  @"1";
#else
  @"";
#endif

  return @{ @"eventName": eventName,
            @"test": testVal,
            @"usingSimulator": simulatorVal,
            @"version": GoKeybaseVersion()};
}

@end
