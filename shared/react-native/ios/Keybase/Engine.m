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
static Boolean goLoaded = NO;
static Boolean jsLoaded = NO;

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
static NSString *const metaEventName = @"objc-meta-engine-event";
static NSString *const metaEventEngineReset = @"engine-reset";
static NSString *const goConnectEventName = @"go-engine-event";


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
  printf("AAA onRNReload\n");
  jsLoaded = NO;
  self.keybaseEngine = nil;
  [self reset];
}

- (void) checkJSAndGoLoaded {
  printf("AAA check js and GO %d %d\n", (int)goLoaded, (int)jsLoaded);
  if (goLoaded && jsLoaded) {
    [self.keybaseEngine sendEventWithName:metaEventName body:metaEventEngineReset];
    [self startReadLoop];
  }
}

- (void)setupKeybaseWithSettings:(NSDictionary *)settings error:(NSError **)error {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    printf("AAA before GO init\n");
    NSUInteger t = arc4random_uniform(10) + 1;
    [NSThread sleepForTimeInterval:t];
    KeybaseInit(settings[@"homedir"], settings[@"sharedHome"], settings[@"logFile"], settings[@"runmode"], settings[@"SecurityAccessGroupOverride"], NULL, NULL, error);
    
    dispatch_async(dispatch_get_main_queue(), ^{
      
      goLoaded = YES;
      [self checkJSAndGoLoaded];
    });
    printf("AAA after GO init\n");
  });
}

- (void)setupQueues {
  self.readQueue = dispatch_queue_create("go_bridge_queue_read", DISPATCH_QUEUE_SERIAL);
  self.writeQueue = dispatch_queue_create("go_bridge_queue_write", DISPATCH_QUEUE_SERIAL);
}

- (void)startReadLoop {
  printf("AAA start read loop\n");
  dispatch_async(self.readQueue, ^{
    while (true) {
      NSError *error = nil;
      NSString * data = KeybaseReadB64(&error);

      if (error) {
        printf("AAA read loop error\n");
        NSLog(@"Error reading data: %@", error);
      }
      if (data) {
        if (!self.keybaseEngine) {
          NSLog(@"NO ENGINE");
          printf("AAA  read loop no engine\n");
        }
        if (self.keybaseEngine.bridge) {
          [self.keybaseEngine sendEventWithName:eventName body:data];
        } else {
          printf("AAA END read loop\n");
          // dead
          break;
        }
      }
    }
  });
}

- (void)start:(KeybaseEngine*)emitter {
  printf("AAA start called from js\n");
  self.keybaseEngine = emitter;
  jsLoaded = YES;
  [self checkJSAndGoLoaded];
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
  if (!goLoaded) {
    return;
  }
  printf("AAA reset called\n");
  KeybaseReset(&error);
  if (jsLoaded) {
    [self.keybaseEngine sendEventWithName:metaEventName body:metaEventEngineReset];
  }
  if (error) {
    NSLog(@"Error in reset: %@", error);
  }
}

@end

#pragma mark - Engine exposed to react

@interface KeybaseEngine ()
@property (strong) NSString * serverConfig;
@end

@implementation KeybaseEngine

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[eventName, metaEventName];
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

- (void) setupServerConfig
{
  NSArray *paths = NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES);
  NSString *cachePath = [paths objectAtIndex:0];
  NSString *filePath = [cachePath stringByAppendingPathComponent:@"/Keybase/keybase.app.serverConfig"];
  NSError * err;
  self.serverConfig = [NSString stringWithContentsOfFile:filePath encoding:NSUTF8StringEncoding error:&err];
}

- (NSDictionary *)constantsToExport {
  [self setupServerConfig];
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
            @"metaEventName": metaEventName,
            @"metaEventEngineReset": metaEventEngineReset,
            @"test": testVal,
            @"appVersionName": appVersionString,
            @"appVersionCode": appBuildString,
            @"usingSimulator": simulatorVal,
            @"serverConfig": self.serverConfig ? self.serverConfig : @"",
            @"version": KeybaseVersion()};
}

@end
