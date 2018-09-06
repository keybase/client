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
#import "Engine.h"
#import "LogSend.h"
#import "RCTLinkingManager.h"
#import <keybase/keybase.h>
#import "Pusher.h"

// Systrace is busted due to the new bridge. Uncomment this to force the old bridge.
// You'll also have to edit the React.xcodeproj. Instructions here:
// https://github.com/facebook/react-native/issues/15003#issuecomment-323715121
//#define SYSTRACING

@interface AppDelegate ()
@property UIBackgroundTaskIdentifier backgroundTask;
@property UIBackgroundTaskIdentifier shutdownTask;
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

- (void) createBackgroundReadableDirectory:(NSString*) path setAllFiles:(BOOL)setAllFiles
{
  NSFileManager* fm = [NSFileManager defaultManager];
  NSError* error = nil;
  NSLog(@"creating background readable directory: path: %@ setAllFiles: %d", path, setAllFiles);
  // Setting NSFileProtectionCompleteUntilFirstUserAuthentication makes the directory accessible as long as the user has
  // unlocked the phone once. The files are still stored on the disk encrypted (note for the chat database, it
  // means we are encrypting it twice), and are inaccessible otherwise.
  NSDictionary* noProt = [NSDictionary dictionaryWithObject:NSFileProtectionCompleteUntilFirstUserAuthentication forKey:NSFileProtectionKey];
  [fm createDirectoryAtPath:path withIntermediateDirectories:YES
                 attributes:noProt
                      error:nil];
  if (![fm setAttributes:noProt ofItemAtPath:path error:&error]) {
    NSLog(@"Error setting file attributes on path: %@ error: %@", path, error);
  }
  if (!setAllFiles) {
    NSLog(@"setAllFiles is false, so returning now");
    return;
  } else {
    NSLog(@"setAllFiles is true charging forward");
  }

  // If the caller wants us to set everything in the directory, then let's do it now (one level down at least)
  NSArray<NSString*>* contents = [fm contentsOfDirectoryAtPath:path error:&error];
  if (contents == nil) {
    NSLog(@"Error listing directory contents: %@", error);
  } else {
    for (NSString* file in contents) {
      if (![fm setAttributes:noProt ofItemAtPath:file error:&error]) {
        NSLog(@"Error setting file attributes on file: %@ error: %@", file, error);
      }
    }
  }
}

- (BOOL) maybeMigrateDirectory:(NSString*)source dest:(NSString*)dest {
  NSError* error = nil;
  NSFileManager* fm = [NSFileManager defaultManager];

  // Always do this copy in case it doesn't work on previous attempts. 
  NSArray<NSString*>* sourceContents = [fm contentsOfDirectoryAtPath:source error:&error];
  if (nil == sourceContents) {
    NSLog(@"Error listing app contents directory: %@", error);
    return NO;
  } else {
    for (NSString* file in sourceContents) {
      BOOL isDirectory = NO;
      NSString* path = [NSString stringWithFormat:@"%@/%@", source, file];
      NSString* destPath = [NSString stringWithFormat:@"%@/%@", dest, file];
      if ([fm fileExistsAtPath:path isDirectory:&isDirectory] && isDirectory) {
        NSLog(@"skipping directory: %@", file);
        continue;
      }
      if (![fm copyItemAtPath:path toPath:destPath error:&error]) {
        if ([error code] == NSFileWriteFileExistsError) {
          // Just charge forward if the file is there already
          continue;
        }
        NSLog(@"Error copying file: %@ error: %@", file, error);
        return NO;
      }
    }
  }
  return YES;
}

- (NSString*) setupHome:(NSString*)home sharedHome:(NSString*)sharedHome {
  // Setup all directories
  NSString* appKeybasePath = [@"~/Library/Application Support/Keybase" stringByExpandingTildeInPath];
  NSString* appEraseableKVPath = [@"~/Library/Application Support/Keybase/eraseablekvstore/device-eks" stringByExpandingTildeInPath];
  NSString* sharedKeybasePath = [NSString stringWithFormat:@"%@/Library/Application Support/Keybase", sharedHome];
  [self createBackgroundReadableDirectory:appKeybasePath setAllFiles:YES];
  [self createBackgroundReadableDirectory:sharedKeybasePath setAllFiles:YES];
  [self createBackgroundReadableDirectory:appEraseableKVPath setAllFiles:YES];
  [self addSkipBackupAttributeToItemAtPath:appKeybasePath];
  [self addSkipBackupAttributeToItemAtPath:sharedKeybasePath];
  
  if (![self maybeMigrateDirectory:appKeybasePath dest:sharedKeybasePath]) {
    return home;
  }
  NSString* sharedEraseableKVPath =  [NSString stringWithFormat:@"%@/Library/Application Support/Keybase/eraseablekvstore/device-eks", sharedHome];
  [self createBackgroundReadableDirectory:sharedEraseableKVPath setAllFiles:YES];
  if (![self maybeMigrateDirectory:appEraseableKVPath dest:sharedEraseableKVPath]) {
    return home;
  }
  
  return sharedHome;
}

- (void) setupGo
{
#if TESTING
  return
#endif

  BOOL securityAccessGroupOverride = isSimulator;
  BOOL skipLogFile = false;

  NSString* home = NSHomeDirectory();
  NSString* sharedHome = [[[NSFileManager defaultManager] containerURLForSecurityApplicationGroupIdentifier:@"group.keybase"] relativePath];
  sharedHome = [self setupHome:home sharedHome:sharedHome];
  
  // Setup app level directories
  NSString* levelDBPath = [@"~/Library/Application Support/Keybase/keybase.leveldb" stringByExpandingTildeInPath];
  NSString* chatLevelDBPath = [@"~/Library/Application Support/Keybase/keybase.chat.leveldb" stringByExpandingTildeInPath];
  NSString* logPath = [@"~/Library/Caches/Keybase" stringByExpandingTildeInPath];
  NSString* serviceLogFile = skipLogFile ? @"" : [logPath stringByAppendingString:@"/ios.log"];
  // Create LevelDB and log directories with a slightly lower data protection mode so we can use them in the background
  [self createBackgroundReadableDirectory:chatLevelDBPath setAllFiles:YES];
  [self createBackgroundReadableDirectory:levelDBPath setAllFiles:YES];
  [self createBackgroundReadableDirectory:logPath setAllFiles:NO];

  NSError* err;
  self.engine = [[Engine alloc] initWithSettings:@{
                                                   @"runmode": @"prod",
                                                   @"homedir": home,
                                                   @"sharedHome": sharedHome,
                                                   @"logFile": serviceLogFile,
                                                   @"serverURI": @"",
                                                   @"SecurityAccessGroupOverride": @(securityAccessGroupOverride)
                                                   } error:&err];
}

#ifdef SYSTRACING
- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge {
  return [NSURL URLWithString:@"http://localhost:8081/index.ios.bundle?platform=ios&dev=true"];
}

- (BOOL)shouldBridgeUseCxxBridge:(RCTBridge *)bridge {
  return NO;
}
#endif

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.fileLogger = [[DDFileLogger alloc] init];
  self.fileLogger.rollingFrequency = 60 * 60 * 24; // 24 hour rolling
  self.fileLogger.logFileManager.maximumNumberOfLogFiles = 3; // 3 days
  [DDLog addLogger:self.fileLogger];

  [self setupGo];
  [self notifyAppState:application];

  NSURL *jsCodeLocation;

  // Uncomment for prod JS in dev mode (and comment the line after
  // that). If you're building onto a phone, you'll have to change
  // localhost:8081 to point to the bundler running on your computer.
  //
//   jsCodeLocation = [NSURL URLWithString:@"http://localhost:8081/index.ios.bundle?platform=ios&dev=false"];
  jsCodeLocation = [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index.ios" fallbackResource:nil];
#ifdef SYSTRACING
  RCTBridge *bridge = [[RCTBridge alloc] initWithDelegate:self
                                            launchOptions:launchOptions];

  RCTRootView *rootView = [[RCTRootView alloc] initWithBridge:bridge moduleName:@"Keybase" initialProperties:nil];
#else
  RCTRootView *rootView = [[RCTRootView alloc] initWithBundleURL:jsCodeLocation
                                                      moduleName:@"Keybase"
                                               initialProperties:nil
                                                   launchOptions:launchOptions];
  rootView.backgroundColor = [UIColor whiteColor];
#endif

  self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
  UIViewController *rootViewController = [UIViewController new];
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

  [[UIApplication sharedApplication]
   setMinimumBackgroundFetchInterval:
   UIApplicationBackgroundFetchIntervalMinimum];

  return YES;
}

-(void) application:(UIApplication *)application performFetchWithCompletionHandler:
(void (^)(UIBackgroundFetchResult))completionHandler {
  NSLog(@"Background fetch started...");
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^(void){
    KeybaseBackgroundSync();
    completionHandler(UIBackgroundFetchResultNewData);
    NSLog(@"Background fetch completed...");
  });
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
// Require for handling silent notifications
- (void)application:(UIApplication *)application didReceiveRemoteNotification:(NSDictionary *)notification fetchCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler {
  NSString* type = notification[@"type"];
  if (type != nil && [type isEqualToString:@"chat.newmessageSilent_2"]) {
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^(void){
      NSError* err = nil;
      NSString* convID = notification[@"c"];
      NSString* body = notification[@"m"];
      int membersType = [notification[@"t"] intValue];
      bool displayPlaintext = [notification[@"n"] boolValue];
      int messageID = [notification[@"d"] intValue];
      NSString* pushID = [notification[@"p"] objectAtIndex:0];
      int badgeCount = [notification[@"b"] intValue];
      int unixTime = [notification[@"x"] intValue];
      NSString* soundName = notification[@"s"];
      PushNotifier* pusher = [[PushNotifier alloc] init];
      // This always tries to unbox the notification and adds a plaintext
      // notification if displayPlaintext is set.
      KeybaseHandleBackgroundNotification(convID, body, membersType, displayPlaintext,
            messageID, pushID, badgeCount, unixTime, soundName, pusher, &err);
      if (err != nil) {
        NSLog(@"Failed to handle in engine: %@", err);
      }
      completionHandler(UIBackgroundFetchResultNewData);
      NSLog(@"Remote notification handle finished...");
    });
  } else {
    [RCTPushNotificationManager didReceiveRemoteNotification:notification];
    completionHandler(UIBackgroundFetchResultNewData);
  }
}

// Required for the localNotification event.
- (void)application:(UIApplication *)application didReceiveLocalNotification:(UILocalNotification *)notification
{
  [RCTPushNotificationManager didReceiveLocalNotification:notification];
}

- (void)applicationWillTerminate:(UIApplication *)application {
  self.window.rootViewController.view.hidden = YES;
  KeybaseAppWillExit([[PushNotifier alloc] init]);
}

- (void) hideCover {
  NSLog(@"hideCover: cancelling outstanding animations...");
  [self.resignImageView.layer removeAllAnimations];
  self.resignImageView.alpha = 0;
}

- (void)applicationWillResignActive:(UIApplication *)application {
  // Always cancel outstanding animations else they can fight and the timing is very weird
  NSLog(@"applicationWillResignActive: cancelling outstanding animations...");
  [self.resignImageView.layer removeAllAnimations];
  // Try a nice animation out
  NSLog(@"applicationWillResignActive: rendering keyz screen...");
  [UIView animateWithDuration:0.3 delay:0.1 options:UIViewAnimationOptionBeginFromCurrentState animations:^{
    self.resignImageView.alpha = 1;
  } completion:^(BOOL finished){
    NSLog(@"applicationWillResignActive: rendered keyz screen. Finished: %d", finished);
  }];
  KeybaseSetAppStateInactive();
}

- (void)applicationDidEnterBackground:(UIApplication *)application {
  // Throw away any saved screenshot just in case anyways
  [application ignoreSnapshotOnNextApplicationLaunch];
  // Always cancel outstanding animations else they can fight and the timing is very weird
  NSLog(@"applicationDidEnterBackground: cancelling outstanding animations...");
  [self.resignImageView.layer removeAllAnimations];
  // Snapshot happens right after this call, force alpha immediately w/o animation else you'll get a half animated overlay
  NSLog(@"applicationDidEnterBackground: setting keyz screen alpha to 1.");
  self.resignImageView.alpha = 1;

  const bool requestTime = KeybaseAppDidEnterBackground();
  if (requestTime && (!self.shutdownTask || self.shutdownTask == UIBackgroundTaskInvalid)) {
    UIApplication *app = [UIApplication sharedApplication];
    self.shutdownTask = [app beginBackgroundTaskWithExpirationHandler:^{
      KeybaseAppWillExit([[PushNotifier alloc] init]);
      [app endBackgroundTask:self.shutdownTask];
      self.shutdownTask = UIBackgroundTaskInvalid;
    }];
    // The service can tell us to end this task early, so if it does, then shutdown
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^(void){
      KeybaseAppBeginBackgroundTask([[PushNotifier alloc] init]);
      if (self.shutdownTask && self.shutdownTask != UIBackgroundTaskInvalid) {
        [app endBackgroundTask:self.shutdownTask];
        self.shutdownTask = UIBackgroundTaskInvalid;
      }
    });
  }
}

// Sometimes these lifecycle calls can be skipped so try and catch them all
- (void)applicationDidBecomeActive:(UIApplication *)application {
  NSLog(@"applicationDidBecomeActive: hiding keyz screen.");
  [self hideCover];
  NSLog(@"applicationDidBecomeActive: notifying service.");
  [self notifyAppState:application];
}

- (void)applicationWillEnterForeground:(UIApplication *)application {
  NSLog(@"applicationWillEnterForeground: hiding keyz screen.");
  [self hideCover];
}

- (void)notifyAppState:(UIApplication *)application {
  const UIApplicationState state = application.applicationState;
  NSLog(@"notifyAppState: notifying service with new appState: %ld", (long)state);
  switch (state) {
    case UIApplicationStateActive:
      KeybaseSetAppStateForeground();
      break;
    case UIApplicationStateBackground:
      KeybaseSetAppStateBackground();
      break;
    case UIApplicationStateInactive:
      KeybaseSetAppStateInactive();
      break;
    default:
      KeybaseSetAppStateForeground();
      break;
  }
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

- (void)applicationDidReceiveMemoryWarning:(UIApplication *)application
{
  KeybaseForceGC();
}

@end
