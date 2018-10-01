//
//  Engine.m
//  Keybase
//
//  Created by Chris Nojima on 8/28/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "Engine.h"

#import <keybase/keybase.h>
#import <React/RCTEventDispatcher.h>
#import "AppDelegate.h"
#import "Utils.h"

// singleton so the exported react component can get it
static Engine * sharedEngine = nil;

@interface Engine ()

@property dispatch_queue_t readQueue;
@property dispatch_queue_t writeQueue;
@property (strong) KeybaseEngine * keybaseEngine;

- (void)start:(KeybaseEngine*)emitter;
- (void)startReadLoop;
- (void)setupQueues;
- (void)runWithData:(NSString *)data;
- (void)reset;
- (void)onRNReload;

@end

@implementation Engine

static NSString *const eventName = @"objc-engine-event";

- (instancetype)initWithSettings:(NSDictionary *)settings error:(NSError **)error {
  if ((self = [super init])) {
    sharedEngine = self;
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(onRNReload) name:RCTJavaScriptWillStartLoadingNotification object:nil];
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

- (void)setupKeybaseWithSettings:(NSDictionary *)settings error:(NSError **)error {
  KeybaseInit(settings[@"homedir"], settings[@"sharedHome"], settings[@"logFile"], settings[@"runmode"], settings[@"SecurityAccessGroupOverride"], NULL, NULL, error);
}

- (void)setupQueues {
  self.readQueue = dispatch_queue_create("go_bridge_queue_read", DISPATCH_QUEUE_SERIAL);
  self.writeQueue = dispatch_queue_create("go_bridge_queue_write", DISPATCH_QUEUE_SERIAL);
}

- (void)startReadLoop {
  dispatch_async(self.readQueue, ^{
    while (true) {
      NSError *error = nil;
      NSString * data = KeybaseReadB64(&error);

      if (error) {
        NSLog(@"Error reading data: %@", error);
      }
      if (data) {
        if (!self.keybaseEngine) {
          NSLog(@"NO ENGINE");
        }
        if (self.keybaseEngine.bridge) {
          [self.keybaseEngine sendEventWithName:eventName body:data];
        } else {
          // dead
          break;
        }
      }
    }
  });
}

- (void)start:(KeybaseEngine*)emitter {
  self.keybaseEngine = emitter;
  [self startReadLoop];
}

- (void)runWithData:(NSString *)data {
  dispatch_async(self.writeQueue, ^{
    NSError *error = nil;
    KeybaseWriteB64(data, &error);
    if (error) {
      NSLog(@"Error writing data: %@", error);
    }
  });
}

- (void)reset {
  NSError *error = nil;
  KeybaseReset(&error);
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

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[eventName];
}

RCT_EXPORT_METHOD(runWithData:(NSString *)data) {
  [sharedEngine runWithData: data];
}

RCT_EXPORT_METHOD(reset) {
  [sharedEngine reset];
}

RCT_EXPORT_METHOD(start) {
  [sharedEngine start: self];
}

- (NSDictionary *)constantsToExport {
  NSString * testVal = [Utils areWeBeingUnitTested] ? @"1" : @"";
  NSString * simulatorVal =
#if TARGET_IPHONE_SIMULATOR
  @"1";
#else
  @"";
#endif

  NSString * appVersionString = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"];
  NSString * appBuildString = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleVersion"];


  return @{ @"eventName": eventName,
            @"test": testVal,
            @"appVersionName": appVersionString,
            @"appVersionCode": appBuildString,
            @"usingSimulator": simulatorVal,
            @"version": KeybaseVersion()};
}

@end
