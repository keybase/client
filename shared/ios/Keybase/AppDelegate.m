//
//  AppDelegate.m
//  Keybase
//
//  Created by Chris Nojima on 9/28/16.
//  Copyright © 2016 Keybase. All rights reserved.
//
#import "AppDelegate.h"
#import <AVFoundation/AVFoundation.h>
#import <UserNotifications/UserNotifications.h>
#import <RNCPushNotificationIOS.h>
#import "Engine.h"
#import "LogSend.h"
#import <React/RCTLinkingManager.h>
#import <React/RCTRootView.h>
#import <React/RCTBundleURLProvider.h>
#import <keybase/keybase.h>
#import "Pusher.h"
#import "Fs.h"
// #import "Storybook.h"
#import <React/RCTConvert.h>

#ifdef FB_SONARKIT_ENABLED
#import <FlipperKit/FlipperClient.h>
#import <FlipperKitLayoutPlugin/FlipperKitLayoutPlugin.h>
#import <FlipperKitUserDefaultsPlugin/FKUserDefaultsPlugin.h>
#import <FlipperKitNetworkPlugin/FlipperKitNetworkPlugin.h>
#import <SKIOSNetworkPlugin/SKIOSNetworkAdapter.h>
#import <FlipperKitReactPlugin/FlipperKitReactPlugin.h>

static void InitializeFlipper(UIApplication *application) {
  FlipperClient *client = [FlipperClient sharedClient];
  SKDescriptorMapper *layoutDescriptorMapper = [[SKDescriptorMapper alloc] initWithDefaults];
  [client addPlugin:[[FlipperKitLayoutPlugin alloc] initWithRootNode:application withDescriptorMapper:layoutDescriptorMapper]];
  [client addPlugin:[[FKUserDefaultsPlugin alloc] initWithSuiteName:nil]];
  [client addPlugin:[FlipperKitReactPlugin new]];
  [client addPlugin:[[FlipperKitNetworkPlugin alloc] initWithNetworkAdapter:[SKIOSNetworkAdapter new]]];
  [client start];
}
#endif

// #import <UMCore/UMModuleRegistry.h>
// #import <UMReactNativeAdapter/UMNativeModulesProxy.h>
// #import <UMReactNativeAdapter/UMModuleRegistryAdapter.h>
#import <RNHWKeyboardEvent.h>

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
#ifdef FB_SONARKIT_ENABLED
  InitializeFlipper(application);
#endif
  
  // allow audio to be mixed
  [[AVAudioSession sharedInstance] setCategory:AVAudioSessionCategoryAmbient error:nil];
  [self setupLogger];
  [self setupGo];
  [self notifyAppState:application];

  // unimodules
  // self.moduleRegistryAdapter = [[UMModuleRegistryAdapter alloc] initWithModuleRegistryProvider: [[UMModuleRegistryProvider alloc] init]];
  
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
   center.delegate = self;

  RCTBridge *bridge = [[RCTBridge alloc] initWithDelegate:self launchOptions:launchOptions];
  RCTRootView *rootView = [[RCTRootView alloc] initWithBridge:bridge
                                                   moduleName:@"Keybase"
                                            initialProperties:nil];
  if (@available(iOS 13.0, *)) {
        rootView.backgroundColor = [UIColor systemBackgroundColor];
    } else {
        rootView.backgroundColor = [UIColor whiteColor];
    }

  self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
  UIViewController *rootViewController = [UIViewController new];
  rootViewController.view = rootView;
  self.window.rootViewController = rootViewController;
  [self.window makeKeyAndVisible];

  // To simplify the cover animation raciness

  // With iPads, we had a bug with this resignImageView where if
  // you backgrounded the app in portrait and then rotated to
  // landscape while the app was in the background, the resignImageView
  // in the snapshot would not be covering the entire app and would
  // display content in the app.  The following code makes the
  // image view a square in the largest dimensipn of the device so
  // that when the iPad OS makes the snapshots the image view is
  // covering in both orientations.
  CGRect screenRect = [UIScreen mainScreen].bounds;
  CGFloat dim = screenRect.size.width;
  if (screenRect.size.height > dim) {
    dim = screenRect.size.height;
  }
  CGRect square;
  square = CGRectMake(screenRect.origin.x, screenRect.origin.y, dim, dim);
  self.resignImageView = [[UIImageView alloc] initWithFrame:square];

  self.resignImageView.contentMode = UIViewContentModeCenter;
  self.resignImageView.alpha = 0;
  self.resignImageView.backgroundColor = rootView.backgroundColor;
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

  // This is a mildly hacky solution to mock out some code when we're in storybook mode.
  // The code that handles this is in `shared/metro.config.js`.
  // NSString *bundlerURL = IS_STORYBOOK ? @"storybook-index" : @"normal-index";
  NSString *bundlerURL = @"index";
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:bundlerURL fallbackResource:nil];
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

// Required for the register event.
- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken
{
 [RNCPushNotificationIOS didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
}

// Require for handling silent notifications
- (void)application:(UIApplication *)application didReceiveRemoteNotification:(NSDictionary *)notification fetchCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler {
  NSString* type = notification[@"type"];
  NSString* body = notification[@"m"];
  int badgeCount = [notification[@"b"] intValue];
  int unixTime = [notification[@"x"] intValue];
  NSString* soundName = notification[@"s"];
  bool displayPlaintext = [notification[@"n"] boolValue];
  int membersType = [notification[@"t"] intValue];
  NSString* sender = notification[@"u"];
  PushNotifier* pusher = [[PushNotifier alloc] init];
  if (type != nil && [type isEqualToString:@"chat.newmessageSilent_2"]) {
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^(void){
      NSError* err = nil;
      NSString* convID = notification[@"c"];
      int messageID = [notification[@"d"] intValue];
      NSString* pushID = [notification[@"p"] objectAtIndex:0];
      // This always tries to unbox the notification and adds a plaintext
      // notification if displayPlaintext is set.
      KeybaseHandleBackgroundNotification(convID, body, @"", sender, membersType, displayPlaintext,
            messageID, pushID, badgeCount, unixTime, soundName, pusher, false, &err);
      if (err != nil) {
        NSLog(@"Failed to handle in engine: %@", err);
      }
      completionHandler(UIBackgroundFetchResultNewData);
      NSLog(@"Remote notification handle finished...");
    });
  } else if (type != nil && [type isEqualToString:@"chat.newmessage"]) {
    [RNCPushNotificationIOS didReceiveRemoteNotification:notification];
    completionHandler(UIBackgroundFetchResultNewData);
  } else {
    [RNCPushNotificationIOS didReceiveRemoteNotification:notification];
    completionHandler(UIBackgroundFetchResultNewData);
  }
}

// Required for the registrationError event.
- (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error
{
 [RNCPushNotificationIOS didFailToRegisterForRemoteNotificationsWithError:error];
}
// Required for localNotification event
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void (^)(void))completionHandler
{
  [RNCPushNotificationIOS didReceiveNotificationResponse:response];
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

- (BOOL)application:(UIApplication *)application
   openURL:(NSURL *)url
   options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options
{
  return [RCTLinkingManager application:application openURL:url options:options];
}

- (BOOL)application:(UIApplication *)application continueUserActivity:(nonnull NSUserActivity *)userActivity
 restorationHandler:(nonnull void (^)(NSArray<id<UIUserActivityRestoring>> * _Nullable))restorationHandler
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
  // NSArray<id<RCTBridgeModule>> *extraModules = [_moduleRegistryAdapter extraModulesForBridge:bridge];
  // You can inject any extra modules that you would like here, more information at:
  // https://facebook.github.io/react-native/docs/native-modules-ios.html#dependency-injection
  // return extraModules;
  return @[];
}

RNHWKeyboardEvent *hwKeyEvent = nil;
- (NSMutableArray<UIKeyCommand *> *)keyCommands {
  NSMutableArray *keys = [NSMutableArray new];
  if (hwKeyEvent == nil) {
    hwKeyEvent = [[RNHWKeyboardEvent alloc] init];
  }
  if ([hwKeyEvent isListening]) {
    [keys addObject: [UIKeyCommand keyCommandWithInput:@"\r" modifierFlags:0 action:@selector(sendEnter:)]];
    [keys addObject: [UIKeyCommand keyCommandWithInput:@"\r" modifierFlags:UIKeyModifierShift action:@selector(sendShiftEnter:)]];
  }
  return keys;
}

- (void)sendEnter:(UIKeyCommand *)sender {
  // Detects user pressing the enter key
  //NSString *selected = sender.input;
  [hwKeyEvent sendHWKeyEvent:@"enter"];
}
- (void)sendShiftEnter:(UIKeyCommand *)sender {
// Detects user pressing the shift-enter combination
  //NSString *selected = sender.input;
  [hwKeyEvent sendHWKeyEvent:@"shift-enter"];
}

@end
