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
#import "GoJSIBridge.h"

// singleton so the exported react component can get it
static Engine * sharedEngine = nil;

@interface Engine ()

@property dispatch_queue_t readQueue;
@property (strong) KeybaseEngine * keybaseEngine;
@property (strong) NSString * sharedHome;

- (void)start:(KeybaseEngine*)emitter;
- (void)startReadLoop;
- (void)setupQueues;
- (void)reset;
- (void)onRNReload;

@end

@implementation Engine

static NSString *const eventName = @"objc-engine-event";
static NSString *const metaEventName = @"objc-meta-engine-event";
static NSString *const metaEventEngineReset = @"engine-reset";


- (instancetype)initWithSettings:(NSDictionary *)settings error:(NSError **)error {
  if ((self = [super init])) {
    sharedEngine = self;
    self.sharedHome = settings[@"sharedHome"];
    [GoJSIBridge setEngine:self];
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
  NSString* systemVer = [[UIDevice currentDevice] systemVersion];
  BOOL isIPad = [[UIDevice currentDevice] userInterfaceIdiom] == UIUserInterfaceIdiomPad;
  KeybaseInit(settings[@"homedir"], settings[@"sharedHome"], settings[@"logFile"], settings[@"runmode"], settings[@"SecurityAccessGroupOverride"], NULL, NULL, systemVer, isIPad, NULL, error);
}

- (void)setupQueues {
  self.readQueue = dispatch_queue_create("go_bridge_queue_read", DISPATCH_QUEUE_SERIAL);
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
        [GoJSIBridge sendToJS: data];
      }
    }
  });
}

- (void)start:(KeybaseEngine*)emitter {
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
  [self.keybaseEngine sendEventWithName:metaEventName body:metaEventEngineReset];
  if (error) {
    NSLog(@"Error in reset: %@", error);
  }
}

@end

#pragma mark - Engine exposed to react

@interface KeybaseEngine ()
@property (strong) NSString * serverConfig;
@property (strong) NSString * guiConfig;
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

- (void) setupGuiConfig
{
  NSString *filePath = [[sharedEngine sharedHome] stringByAppendingPathComponent:@"/Library/Application Support/Keybase/gui_config.json"];
  NSError * err;
  self.guiConfig = [NSString stringWithContentsOfFile:filePath encoding:NSUTF8StringEncoding error:&err];
}

// from react-native-localize
- (bool)uses24HourClockForLocale:(NSLocale * _Nonnull)locale {
  NSDateFormatter* formatter = [NSDateFormatter new];

  [formatter setLocale:locale];
  [formatter setTimeZone:[NSTimeZone timeZoneForSecondsFromGMT:0]];
  [formatter setDateStyle:NSDateFormatterNoStyle];
  [formatter setTimeStyle:NSDateFormatterShortStyle];

  NSDate *date = [NSDate dateWithTimeIntervalSince1970:72000];
  return [[formatter stringFromDate:date] containsString:@"20"];
}

- (NSDictionary *)constantsToExport {
  [self setupServerConfig];
  [self setupGuiConfig];
#if TARGET_IPHONE_SIMULATOR
  NSString * simulatorVal = @"1";
#else
  NSString * simulatorVal = @"";
#endif
  
  NSString * darkModeSupported = @"0";
  if (@available(iOS 13.0, *)) {
    darkModeSupported = @"1";
  };

  NSString * appVersionString = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"];
  NSString * appBuildString = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleVersion"];
  NSLocale *currentLocale = [NSLocale currentLocale];
  
  return @{ @"eventName": eventName,
            @"metaEventName": metaEventName,
            @"metaEventEngineReset": metaEventEngineReset,
            @"appVersionName": appVersionString,
            @"appVersionCode": appBuildString,
            @"darkModeSupported": darkModeSupported,
            @"usingSimulator": simulatorVal,
            @"serverConfig": self.serverConfig ? self.serverConfig : @"",
            @"guiConfig": self.guiConfig ? self.guiConfig : @"",
            @"uses24HourClock": @([self uses24HourClockForLocale:currentLocale]),
            @"version": KeybaseVersion()};
}

@end
