//
//  ObjcEngine.m
//  Keybase
//
//  Created by Chris Nojima on 8/28/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "ObjcEngine.h"
#import <keybaselib/keybaselib.h>
#import "RCTEventDispatcher.h"

@interface Engine : NSObject

@property dispatch_queue_t readQueue;
@property dispatch_queue_t writeQueue;
@property (weak) RCTBridge *bridge;

- (void)startReadLoop;
- (void)initQueues;
- (void)runWithData:(NSString*) data;

@end

@implementation Engine

static NSString * const eventName = @"objc-engine-event";

+ (instancetype)sharedInstance
{
  static Engine *sharedInstance = nil;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    sharedInstance = [[Engine alloc] init];
  });
  return sharedInstance;
}

-(instancetype) init {
  if(self = [super init]) {
    [self initQueues];
    [self startReadLoop];
  }

  return self;
}

-(void) initQueues {
  self.readQueue = dispatch_queue_create ("go_bridge_queue_read", DISPATCH_QUEUE_SERIAL);
  self.writeQueue = dispatch_queue_create ("go_bridge_queue_write", DISPATCH_QUEUE_SERIAL);
}

// This just starts an infinite loop in the read queue. TODO talk to gabriel how we'd like to model this. Could do a nsoperation queue or
// something. previously i was bouncing this into another async call after each run but it's not strickly necessary
-(void) startReadLoop {
  dispatch_async(self.readQueue, ^{
    for(;;) {
      NSString * data = GoKeybaselibRead();
      if(data) {
          [self.bridge.eventDispatcher sendAppEventWithName:eventName body:data];
      }
    }
  });
}

-(void) runWithData:(NSString*) data {
  dispatch_async(self.writeQueue, ^{
    GoKeybaselibWrite(data);
  });
}

@end

#pragma mark - Engine exposed to react

@implementation ObjcEngine

RCT_EXPORT_MODULE();

// required by reactnative
@synthesize bridge = _bridge;

RCT_EXPORT_METHOD(runWithData: (NSString*) data)
{
  [Engine sharedInstance].bridge = _bridge;
  [[Engine sharedInstance] runWithData: data];
}

- (NSDictionary *)constantsToExport
{
  return @{ @"eventName": eventName };
}

@end
