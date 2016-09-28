//
//  AppDelegate.m
//  Keybase
//
//  Created by Chris Nojima on 9/28/16.
//  Copyright © 2016 Keybase. All rights reserved.
//

#import "AppDelegate.h"

#import "RCTBundleURLProvider.h"
#import "RCTRootView.h"
#import "KeyListener.h"
#import "Engine.h"
#import "LogSend.h"

@interface AppDelegate ()

@property (nonatomic, strong) LogSend * logSender;

@end

@implementation AppDelegate

- (void) setupGo
{

  NSNumber * SecurityAccessGroupOverride =
#if SIMULATOR
  @YES;
#else
  @NO;
#endif

  NSString * home = NSHomeDirectory();

#if TESTING
#else
  NSString * logFile = [home stringByAppendingPathComponent:@"ios.log"];

  NSError * err;
  self.engine = [[Engine alloc] initWithSettings:@{
                                                   @"runmode": @"staging",
                                                   @"homedir": home,
                                                   @"logFile": logFile,
                                                   @"serverURI": @"",
                                                   @"SecurityAccessGroupOverride": SecurityAccessGroupOverride
                                                   } error:&err];

  self.logSender = [[LogSend alloc] initWithPath:logFile];
#endif

}

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  [self setupGo];

  NSURL *jsCodeLocation;

  jsCodeLocation = [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index.ios" fallbackResource:nil];

  RCTRootView *rootView = [[RCTRootView alloc] initWithBundleURL:jsCodeLocation
                                                      moduleName:@"Keybase"
                                               initialProperties:nil
                                                   launchOptions:launchOptions];
  rootView.backgroundColor = [[UIColor alloc] initWithRed:1.0f green:1.0f blue:1.0f alpha:1];

  self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
  KeyListener *rootViewController = [KeyListener new];
  rootViewController.bridge = rootView.bridge;
  rootViewController.view = rootView;
  self.window.rootViewController = rootViewController;
  [self.window makeKeyAndVisible];
  return YES;
}

@end
