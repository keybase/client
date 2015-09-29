//
//  ObjcEngine.m
//  Keybase
//
//  Created by Chris Nojima on 8/28/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "ObjcEngine.h"
#import <keybase/keybase.h>
#import "RCTEventDispatcher.h"
#import "AppDelegate.h"

@interface Engine()

@property dispatch_queue_t readQueue;
@property dispatch_queue_t writeQueue;
@property (weak) RCTBridge *bridge;

- (void)startReadLoop;
- (void)setupQueues;
- (void)runWithData:(NSString*) data;
- (void)reset;

@end

@implementation Engine

static NSString * const eventName = @"objc-engine-event";

- (instancetype) initWithSettings:(NSDictionary*) settings {
  if ((self = [super init])) {
    [self setupKeybaseWithSettings:settings];
    [self setupQueues];
    [self startReadLoop];
  }

  return self;
}

- (void) setupKeybaseWithSettings:(NSDictionary*) settings {
  GoKeybaseInit(settings[@"homedir"], settings[@"runmode"], settings[@"serverURI"]);
}

- (void) setupQueues {
  self.readQueue = dispatch_queue_create ("go_bridge_queue_read", DISPATCH_QUEUE_SERIAL);
  self.writeQueue = dispatch_queue_create ("go_bridge_queue_write", DISPATCH_QUEUE_SERIAL);
}

// This just starts an infinite loop in the read queue. TODO talk to gabriel how we'd like to model this. Could do a nsoperation queue or
// something. previously i was bouncing this into another async call after each run but it's not strickly necessary
- (void) startReadLoop {
  dispatch_async(self.readQueue, ^{
    for(;;) {
      NSString * data = GoKeybaseReadB64();
      if(data) {
          [self.bridge.eventDispatcher sendAppEventWithName:eventName body:data];
      }
    }
  });
}

- (void) runWithData:(NSString*) data {
  dispatch_async(self.writeQueue, ^{
    GoKeybaseWriteB64(data);
  });
}

- (void) reset {
  GoKeybaseReset();
}

@end

#pragma mark - Engine exposed to react

@interface ObjcEngine : NSObject<RCTBridgeModule>
@property (readonly) ObjcEngine* engine;
@end

@implementation ObjcEngine

- (Engine*) engine {
  AppDelegate * delegate = [UIApplication sharedApplication].delegate;
  return delegate.engine;
}

RCT_EXPORT_MODULE();

// required by reactnative
@synthesize bridge = _bridge;


RCT_EXPORT_METHOD(runWithData: (NSString*) data)
{
  self.engine.bridge = _bridge;
  [self.engine runWithData: data];
}

RCT_EXPORT_METHOD(reset)
{
  [self.engine reset];
}

- (NSDictionary *)constantsToExport
{
  return @{ @"eventName": eventName };
}

@end
