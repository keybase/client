//
//  AppDelegate.m
//  Keybase
//
//  Created by Chris Nojima on 9/28/16.
//  Copyright © 2016 Keybase. All rights reserved.
//

#import "AppDelegate.h"
#import "RCTPushNotificationManager.h"
#import "RCTBundleURLProvider.h"
#import "RCTRootView.h"
#import "KeyListener.h"
#import "Engine.h"
#import "LogSend.h"
#import "RCTLinkingManager.h"

@interface AppDelegate ()
@end

#if TARGET_OS_SIMULATOR
const BOOL isSimulator = YES;
#else
const BOOL isSimulator = NO;
#endif

#if DEBUG
const BOOL isDebug = YES;
#else
const BOOL isDebug = NO;
#endif

@implementation AppDelegate

- (BOOL)addSkipBackupAttributeToItemAtPath:(NSString *) filePathString
{
  NSURL * URL = [NSURL fileURLWithPath: filePathString];
  NSError * error = nil;
  BOOL success = [URL setResourceValue: @YES forKey: NSURLIsExcludedFromBackupKey error: &error];
  if(!success){
    NSLog(@"Error excluding %@ from backup %@", [URL lastPathComponent], error);
  }
  return success;
}

- (void) setupGo
{
#if TESTING
  return
#endif

  BOOL securityAccessGroupOverride = isSimulator;
  BOOL skipLogFile = false;

  NSString * home = NSHomeDirectory();

  NSString * keybasePath = [@"~/Library/Application Support/Keybase" stringByExpandingTildeInPath];
  NSString * serviceLogFile = skipLogFile ? @"" : [@"~/Library/Caches/Keybase/ios.log" stringByExpandingTildeInPath];
  NSString * rnLogFile = [@"~/Library/Caches/Keybase/rn.log" stringByExpandingTildeInPath];

  // Make keybasePath if it doesn't exist
  [[NSFileManager defaultManager] createDirectoryAtPath:keybasePath
                            withIntermediateDirectories:YES
                                             attributes:nil
                                                  error:nil];
  [self addSkipBackupAttributeToItemAtPath:keybasePath];


  NSError * err;
  self.engine = [[Engine alloc] initWithSettings:@{
                                                   @"runmode": @"prod",
                                                   @"homedir": home,
                                                   @"logFile": serviceLogFile,
                                                   @"serverURI": @"",
                                                   @"SecurityAccessGroupOverride": @(securityAccessGroupOverride)
                                                   } error:&err];

  [LogSend setPath:rnLogFile];
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
  rootView.backgroundColor = [UIColor whiteColor];

  self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
  KeyListener *rootViewController = [KeyListener new];
  rootViewController.bridge = rootView.bridge;
  rootViewController.view = rootView;
  self.window.rootViewController = rootViewController;
  [self.window makeKeyAndVisible];
  return YES;
}

// Required to register for notifications
- (void)application:(UIApplication *)application didRegisterUserNotificationSettings:(UIUserNotificationSettings *)notificationSettings
{
  [RCTPushNotificationManager didRegisterUserNotificationSettings:notificationSettings];
}
// Required for the register event.
- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken
{
  [RCTPushNotificationManager didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
}
// Required for the registrationError event.
- (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error
{
  [RCTPushNotificationManager didFailToRegisterForRemoteNotificationsWithError:error];
}
// Required for the notification event.
- (void)application:(UIApplication *)application didReceiveRemoteNotification:(NSDictionary *)notification
{
  [RCTPushNotificationManager didReceiveRemoteNotification:notification];
}
// Required for the localNotification event.
- (void)application:(UIApplication *)application didReceiveLocalNotification:(UILocalNotification *)notification
{
  [RCTPushNotificationManager didReceiveLocalNotification:notification];
}

- (void)applicationWillResignActive:(UIApplication *)application
{
  self.resignImageView = [[UIImageView alloc] initWithFrame:self.window.bounds];
  self.resignImageView.contentMode = UIViewContentModeCenter;
  self.resignImageView.alpha = 0;
  self.resignImageView.backgroundColor = [UIColor whiteColor];
  [self.resignImageView setImage:[UIImage imageNamed:@"LaunchImage"]];
  [self.window addSubview:self.resignImageView];

  [UIView animateWithDuration:0.5 delay:0.1 options:0 animations:^{
    self.resignImageView.alpha = 1;
  } completion:nil];
}

- (void)applicationDidBecomeActive:(UIApplication *)application
{
  [UIView animateWithDuration:0.5 animations:^{
    self.resignImageView.alpha = 0;
  } completion:^(BOOL finished) {
    [self.resignImageView removeFromSuperview];
  }];
}

- (BOOL)application:(UIApplication *)application openURL:(NSURL *)url
  sourceApplication:(NSString *)sourceApplication annotation:(id)annotation
{
  return [RCTLinkingManager application:application openURL:url
                      sourceApplication:sourceApplication annotation:annotation];
}

- (BOOL)application:(UIApplication *)application continueUserActivity:(NSUserActivity *)userActivity
 restorationHandler:(void (^)(NSArray * _Nullable))restorationHandler
{
  return [RCTLinkingManager application:application
                   continueUserActivity:userActivity
                     restorationHandler:restorationHandler];
}

@end
