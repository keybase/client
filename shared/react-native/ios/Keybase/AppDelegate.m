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

@interface AppDelegate ()

@property (nonatomic, strong) LogSend * logSender;

@end

@implementation AppDelegate

- (BOOL)addSkipBackupAttributeToItemAtPath:(NSString *) filePathString
{
  NSURL* URL= [NSURL fileURLWithPath: filePathString];
  assert([[NSFileManager defaultManager] fileExistsAtPath: [URL path]]);

  NSError *error = nil;
  BOOL success = [URL setResourceValue: [NSNumber numberWithBool: YES]
                                forKey: NSURLIsExcludedFromBackupKey error: &error];
  if(!success){
    NSLog(@"Error excluding %@ from backup %@", [URL lastPathComponent], error);
  }
  return success;
}

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
  NSString * library = [home stringByAppendingPathComponent:@"Library"];
  NSString * appSupport = [library stringByAppendingPathComponent:@"Application Support"];
  NSString * keybasePath = [appSupport stringByAppendingPathComponent:@"Keybase"];
  NSString * logFile = [keybasePath stringByAppendingPathComponent:@"ios.log"];

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

@end
