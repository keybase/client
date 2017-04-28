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

UIBackgroundTaskIdentifier backgroundTask;

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

- (void) createLevelDBDir:(NSString*) path
{
  NSFileManager* fm = [NSFileManager defaultManager];
  // Setting NSFileProtectionCompleteUnlessOpen makes the directory accessible as long as the user has
  // opened it once unlocked. The files are still stored on the disk encrypted (note for the chat database, it
  // means we are encrypting it twice), and are inaccessible otherwise.
  NSDictionary* noProt = [NSDictionary dictionaryWithObject:NSFileProtectionCompleteUnlessOpen forKey:NSFileProtectionKey];
  [fm createDirectoryAtPath:path withIntermediateDirectories:YES
                 attributes:noProt
                      error:nil];
  [fm setAttributes:noProt ofItemAtPath:path error:nil];
}

- (void) setupGo
{
#if TESTING
  return
#endif

  BOOL securityAccessGroupOverride = isSimulator;
  BOOL skipLogFile = true;

  NSString * home = NSHomeDirectory();

  NSString * keybasePath = [@"~/Library/Application Support/Keybase" stringByExpandingTildeInPath];
  NSString * levelDBPath = [@"~/Library/Application Support/Keybase/keybase.leveldb" stringByExpandingTildeInPath];
  NSString * chatLevelDBPath = [@"~/Library/Application Support/Keybase/keybase.chat.leveldb" stringByExpandingTildeInPath];
  NSString * serviceLogFile = skipLogFile ? @"" : [@"~/Library/Caches/Keybase/ios.log" stringByExpandingTildeInPath];
  NSString * rnLogFile = [@"~/Library/Caches/Keybase/rn.log" stringByExpandingTildeInPath];
  NSFileManager* fm = [NSFileManager defaultManager];
  
  // Make keybasePath if it doesn't exist
  [fm createDirectoryAtPath:keybasePath
                            withIntermediateDirectories:YES
                            attributes:nil
                            error:nil];
  [self addSkipBackupAttributeToItemAtPath:keybasePath];
  
  // Create LevelDB directories with a slightly lower data protection mode so we can use them in the background
  [self createLevelDBDir:chatLevelDBPath];
  [self createLevelDBDir:levelDBPath];

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

  // To simplify the cover animation raciness
  self.resignImageView = [[UIImageView alloc] initWithFrame:self.window.bounds];
  self.resignImageView.contentMode = UIViewContentModeCenter;
  self.resignImageView.alpha = 0;
  self.resignImageView.backgroundColor = [UIColor whiteColor];
  [self.resignImageView setImage:[UIImage imageNamed:@"LaunchImage"]];
  [self.window addSubview:self.resignImageView];

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
// fetch notifications in the background and foreground
- (void)application:(UIApplication *)application didReceiveRemoteNotification:(NSDictionary *)notification fetchCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler {

  // Mark a background task so we don't get insta killed by the OS
  if (!backgroundTask || backgroundTask == UIBackgroundTaskInvalid) {
    backgroundTask = [[UIApplication sharedApplication] beginBackgroundTaskWithExpirationHandler:^{
      [[UIApplication sharedApplication] endBackgroundTask:backgroundTask];
      backgroundTask = UIBackgroundTaskInvalid;
    }];
  }
  
  [RCTPushNotificationManager didReceiveRemoteNotification:notification];
  completionHandler(UIBackgroundFetchResultNewData);
  }
// Required for the localNotification event.
- (void)application:(UIApplication *)application didReceiveLocalNotification:(UILocalNotification *)notification
{
  [RCTPushNotificationManager didReceiveLocalNotification:notification];
}

- (void)applicationWillTerminate:(UIApplication *)application {
  self.window.rootViewController.view.hidden = YES;
}

- (void) hideCover {
  // Always cancel outstanding animations else they can fight and the timing is very weird
  [self.resignImageView.layer removeAllAnimations];
  [UIView animateWithDuration:0.3 delay:0.3 options:UIViewAnimationOptionBeginFromCurrentState animations:^{
    self.resignImageView.alpha = 0;
  } completion:nil];
}

- (void)applicationWillResignActive:(UIApplication *)application {
  // Always cancel outstanding animations else they can fight and the timing is very weird
  [self.resignImageView.layer removeAllAnimations];
  // Try a nice animation out
  [UIView animateWithDuration:0.3 delay:0.1 options:UIViewAnimationOptionBeginFromCurrentState animations:^{
    self.resignImageView.alpha = 1;
  } completion:nil];
}

- (void)applicationDidEnterBackground:(UIApplication *)application {
  // Throw away any saved screenshot just in case anyways
  [application ignoreSnapshotOnNextApplicationLaunch];
  // Always cancel outstanding animations else they can fight and the timing is very weird
  [self.resignImageView.layer removeAllAnimations];
  // Snapshot happens right after this call, force alpha immediately w/o animation else you'll get a half animated overlay
  self.resignImageView.alpha = 1;
}

// Sometimes these lifecycle calls can be skipped so try and catch them all
- (void)applicationDidBecomeActive:(UIApplication *)application {
  [self hideCover];
}

- (void)applicationWillEnterForeground:(UIApplication *)application {
  [self hideCover];
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
