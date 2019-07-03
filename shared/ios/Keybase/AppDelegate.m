//
//  AppDelegate.m
//  Keybase
//
//  Created by Chris Nojima on 9/28/16.
//  Copyright © 2016 Keybase. All rights reserved.
//
#import "AppDelegate.h"
#import <AVFoundation/AVFoundation.h> 
#import <React/RCTPushNotificationManager.h>
#import <React/RCTBundleURLProvider.h>
#import <React/RCTRootView.h>
#import "Engine.h"
#import "LogSend.h"
#import <React/RCTLinkingManager.h>
#import <keybase/keybase.h>
#import "Pusher.h"
#import "Fs.h"

#import <UMCore/UMModuleRegistry.h>
#import <UMReactNativeAdapter/UMNativeModulesProxy.h>
#import <UMReactNativeAdapter/UMModuleRegistryAdapter.h>

@interface AppDelegate ()
@property UIBackgroundTaskIdentifier backgroundTask;
@property UIBackgroundTaskIdentifier shutdownTask;
@end


@implementation AppDelegate

- (void) setupGo
{
#if TARGET_OS_SIMULATOR
  BOOL securityAccessGroupOverride = YES;
#else
  BOOL securityAccessGroupOverride = NO;
#endif
  // set to true to see logs in xcode
  BOOL skipLogFile = false;

  NSDictionary* fsPaths = [[FsHelper alloc] setupFs:skipLogFile setupSharedHome:YES];
  NSError* err;
  self.engine = [[Engine alloc] initWithSettings:@{
                                                   @"runmode": @"prod",
                                                   @"homedir": fsPaths[@"home"],
                                                   @"sharedHome": fsPaths[@"sharedHome"],
                                                   @"logFile": fsPaths[@"logFile"],
                                                   @"serverURI": @"",
                                                   @"SecurityAccessGroupOverride": @(securityAccessGroupOverride)
                                                   } error:&err];
}

- (void) setupLogger
{
  self.fileLogger = [[DDFileLogger alloc] init];
  self.fileLogger.rollingFrequency = 60 * 60 * 24; // 24 hour rolling
  self.fileLogger.logFileManager.maximumNumberOfLogFiles = 3; // 3 days
  [DDLog addLogger:self.fileLogger];
}

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // allow audio to be mixed
  [[AVAudioSession sharedInstance] setCategory:AVAudioSessionCategoryAmbient error:nil];
  [self setupLogger];
  [self setupGo];
  [self notifyAppState:application];

  // unimodules
  self.moduleRegistryAdapter = [[UMModuleRegistryAdapter alloc] initWithModuleRegistryProvider: [[UMModuleRegistryProvider alloc] init]];

  RCTBridge *bridge = [[RCTBridge alloc] initWithDelegate:self launchOptions:launchOptions];
  RCTRootView *rootView = [[RCTRootView alloc] initWithBridge:bridge
                                                   moduleName:@"Keybase"
                                            initialProperties:nil];
  rootView.backgroundColor = [[UIColor alloc] initWithRed:1.0f green:1.0f blue:1.0f alpha:1];

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

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
#if DEBUG
  // uncomment to get a prod bundle. If you set this it remembers so set it back and re-run to reset it!
//  [[RCTBundleURLProvider sharedSettings] setEnableDev: false];
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index" fallbackResource:nil];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
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
  } else if (type != nil && [type isEqualToString:@"chat.newmessage"]) {
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^(void){
      NSError* err = nil;
      NSString* convID = notification[@"convID"];
      NSString* body = notification[@"m"];
      int membersType = [notification[@"t"] intValue];
      int messageID = [notification[@"msgID"] intValue];
      KeybaseHandleBackgroundNotification(convID, body, membersType, false,
                                          messageID, @"", 0, 0, @"", nil, &err);
      if (err != nil) {
        NSLog(@"Failed to handle in engine: %@", err);
      }
    });
    [RCTPushNotificationManager didReceiveRemoteNotification:notification];
    completionHandler(UIBackgroundFetchResultNewData);
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

- (BOOL) application:(UIApplication *)application continueUserActivity:(NSUserActivity *)userActivity restorationHandler:(void (^)(NSArray<id<UIUserActivityRestoring>> * _Nullable))restorationHandler
{
    return [RCTLinkingManager application:application
                     continueUserActivity:userActivity
                       restorationHandler:restorationHandler];
}

- (void)applicationDidReceiveMemoryWarning:(UIApplication *)application
{
  KeybaseForceGC();
}

- (NSArray<id<RCTBridgeModule>> *)extraModulesForBridge:(RCTBridge *)bridge
{
  NSArray<id<RCTBridgeModule>> *extraModules = [_moduleRegistryAdapter extraModulesForBridge:bridge];
  // You can inject any extra modules that you would like here, more information at:
  // https://facebook.github.io/react-native/docs/native-modules-ios.html#dependency-injection
  return extraModules;
}

@end
