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
#include <resolv.h>
#include <dns.h>
#include <arpa/inet.h>
#include <ifaddrs.h>

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

- (NSString *) getDNSServer
{
  res_state res = malloc(sizeof(struct __res_state));
  int result = res_ninit(res);
  if (result == 0) {
    union res_9_sockaddr_union *addr_union = malloc(res->nscount * sizeof(union res_9_sockaddr_union));
    res_getservers(res, addr_union, res->nscount);
    
    for (int i = 0; i < res->nscount; i++) {
      if (addr_union[i].sin.sin_family == AF_INET) {
        char ip[INET_ADDRSTRLEN];
        inet_ntop(AF_INET, &(addr_union[i].sin.sin_addr), ip, INET_ADDRSTRLEN);
        NSString *dnsIP = [NSString stringWithUTF8String:ip];
        return dnsIP;
      } else if (addr_union[i].sin6.sin6_family == AF_INET6) {
        char ip[INET6_ADDRSTRLEN];
        inet_ntop(AF_INET6, &(addr_union[i].sin6.sin6_addr), ip, INET6_ADDRSTRLEN);
        NSString *dnsIP = [NSString stringWithUTF8String:ip];
        return dnsIP;
      }
    }
  }
  res_nclose(res);
  return @"127.0.0.1";
}

- (void) setupGo
{
#if TESTING
  return
#endif

  BOOL securityAccessGroupOverride = isSimulator;
  BOOL skipLogFile = true;

  NSString * home = NSHomeDirectory();
  NSString * dnsServer = [ self getDNSServer ];

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
                                                   @"SecurityAccessGroupOverride": @(securityAccessGroupOverride),
                                                   @"dnsServer": dnsServer
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
  self.resignImageView.backgroundColor = [UIColor whiteColor];
  [self.resignImageView setImage:[UIImage imageNamed:@"LaunchImage"]];
  [self.window addSubview:self.resignImageView];
}

- (void)applicationDidBecomeActive:(UIApplication *)application
{
  [self.resignImageView removeFromSuperview];
}

@end
