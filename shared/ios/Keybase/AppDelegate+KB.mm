//
//  AppKeybase.m
//  Keybase
//
//  Created by Chris Nojima on 10/31/22.
//  Copyright © 2022 Keybase. All rights reserved.
//

#import "AppDelegate+KB.h"
#import "Fs.h"
#import <keybase/keybase.h>
#import "Pusher.h"
#import <AVFoundation/AVFoundation.h>
#import <RNCPushNotificationIOS.h>
#import <RNHWKeyboardEvent.h>
#import <React/RCTLinkingManager.h>
#import <UserNotifications/UserNotifications.h>

@implementation AppDelegate(KB)

- (void)setupGo {
  // set to true to see logs in xcode
  BOOL skipLogFile = false;
  // uncomment to get more console.logs
  // RCTSetLogThreshold(RCTLogLevelInfo - 1);
  self.fsPaths = [[FsHelper alloc] setupFs:skipLogFile setupSharedHome:YES];

  NSString *systemVer = [[UIDevice currentDevice] systemVersion];
  BOOL isIPad =
      [[UIDevice currentDevice] userInterfaceIdiom] == UIUserInterfaceIdiomPad;
  BOOL isIOS = YES;

#if TARGET_OS_SIMULATOR
  BOOL securityAccessGroupOverride = YES;
#else
  BOOL securityAccessGroupOverride = NO;
#endif

  NSError *err;
  KeybaseInit(self.fsPaths[@"homedir"], self.fsPaths[@"sharedHome"],
              self.fsPaths[@"logFile"], @"prod", securityAccessGroupOverride,
              NULL, NULL, systemVer, isIPad, NULL, isIOS, &err);
}

- (void)notifyAppState:(UIApplication *)application {
  const UIApplicationState state = application.applicationState;
  NSLog(@"notifyAppState: notifying service with new appState: %ld",
        (long)state);
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

- (void)didLaunchSetupBefore:(UIApplication *)application {
  // allow audio to be mixed
  [[AVAudioSession sharedInstance] setCategory:AVAudioSessionCategoryAmbient
                                         error:nil];
  [self setupGo];
  [self notifyAppState:application];

  UNUserNotificationCenter *center =
      [UNUserNotificationCenter currentNotificationCenter];
  center.delegate = self;
}

- (void)didLaunchSetupAfter: (UIView*) rootView {
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
}

- (void) addDrop: (UIView*) rootView{
  UIDropInteraction *udi = [[UIDropInteraction alloc] initWithDelegate:self];
  udi.allowsSimultaneousDropSessions = YES;
  [rootView addInteraction:udi];
}

- (BOOL)dropInteraction:(UIDropInteraction *)interaction
       canHandleSession:(id<UIDropSession>)session {
  return YES;
}

- (UIDropProposal *)dropInteraction:(UIDropInteraction *)interaction
                   sessionDidUpdate:(id<UIDropSession>)session {
  return [[UIDropProposal alloc] initWithDropOperation:UIDropOperationCopy];
}

- (void)dropInteraction:(UIDropInteraction *)interaction
            performDrop:(id<UIDropSession>)session {
  __weak __typeof__(self) weakSelf = self;
  NSMutableArray *items =
      [NSMutableArray arrayWithCapacity:session.items.count];
  [session.items
      enumerateObjectsUsingBlock:^(id obj, NSUInteger idx, BOOL *stop) {
        UIDragItem *i = obj;
        [items addObject:i.itemProvider];
      }];
  self.iph = [[ItemProviderHelper alloc]
           initForShare:false
              withItems:items
             attrString:@""
      completionHandler:^{
        NSURL *url = [NSURL URLWithString:@"keybase://incoming-share"];
        __typeof__(self) strongSelf = weakSelf;
        [strongSelf application:[UIApplication sharedApplication]
                      openURL:url
                      options:@{}];
        strongSelf.iph = nil;
      }];
  [self.iph startProcessing];
}


- (void)application:(UIApplication *)application
    performFetchWithCompletionHandler:
        (void (^)(UIBackgroundFetchResult))completionHandler {
  NSLog(@"Background fetch started...");
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0),
                 ^(void) {
                   KeybaseBackgroundSync();
                   completionHandler(UIBackgroundFetchResultNewData);
                   NSLog(@"Background fetch completed...");
                 });
}

// Required for the register event.
- (void)application:(UIApplication *)application
    didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken {
  [RNCPushNotificationIOS
      didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
}

// Require for handling silent notifications
- (void)application:(UIApplication *)application
    didReceiveRemoteNotification:(NSDictionary *)notification
          fetchCompletionHandler:
              (void (^)(UIBackgroundFetchResult))completionHandler {
  NSString *type = notification[@"type"];
  NSString *body = notification[@"m"];
  int badgeCount = [notification[@"b"] intValue];
  int unixTime = [notification[@"x"] intValue];
  NSString *soundName = notification[@"s"];
  bool displayPlaintext = [notification[@"n"] boolValue];
  int membersType = [notification[@"t"] intValue];
  NSString *sender = notification[@"u"];
  PushNotifier *pusher = [[PushNotifier alloc] init];
  if (type != nil && [type isEqualToString:@"chat.newmessageSilent_2"]) {
    dispatch_async(
        dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^(void) {
          NSError *err = nil;
          NSString *convID = notification[@"c"];
          int messageID = [notification[@"d"] intValue];
          NSString *pushID = [notification[@"p"] objectAtIndex:0];
          // This always tries to unbox the notification and adds a plaintext
          // notification if displayPlaintext is set.
          KeybaseHandleBackgroundNotification(
              convID, body, @"", sender, membersType, displayPlaintext,
              messageID, pushID, badgeCount, unixTime, soundName, pusher, false,
              &err);
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
- (void)application:(UIApplication *)application
    didFailToRegisterForRemoteNotificationsWithError:(NSError *)error {
  [RNCPushNotificationIOS
      didFailToRegisterForRemoteNotificationsWithError:error];
}
// Required for localNotification event
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
    didReceiveNotificationResponse:(UNNotificationResponse *)response
             withCompletionHandler:(void (^)(void))completionHandler {
  [RNCPushNotificationIOS didReceiveNotificationResponse:response];
}

- (void)applicationWillTerminate:(UIApplication *)application {
  self.window.rootViewController.view.hidden = YES;
  KeybaseAppWillExit([[PushNotifier alloc] init]);
}

- (void)hideCover {
  NSLog(@"hideCover: cancelling outstanding animations...");
  [self.resignImageView.layer removeAllAnimations];
  self.resignImageView.alpha = 0;
}

- (void)applicationWillResignActive:(UIApplication *)application {
  // Always cancel outstanding animations else they can fight and the timing is
  // very weird
  NSLog(@"applicationWillResignActive: cancelling outstanding animations...");
  [self.resignImageView.layer removeAllAnimations];
  // Try a nice animation out
  NSLog(@"applicationWillResignActive: rendering keyz screen...");
  [UIView animateWithDuration:0.3
      delay:0.1
      options:UIViewAnimationOptionBeginFromCurrentState
      animations:^{
        self.resignImageView.alpha = 1;
      }
      completion:^(BOOL finished) {
        NSLog(
            @"applicationWillResignActive: rendered keyz screen. Finished: %d",
            finished);
      }];
  KeybaseSetAppStateInactive();
}

- (void)applicationDidEnterBackground:(UIApplication *)application {
  // Throw away any saved screenshot just in case anyways
  [application ignoreSnapshotOnNextApplicationLaunch];
  // Always cancel outstanding animations else they can fight and the timing is
  // very weird
  NSLog(@"applicationDidEnterBackground: cancelling outstanding animations...");
  [self.resignImageView.layer removeAllAnimations];
  // Snapshot happens right after this call, force alpha immediately w/o
  // animation else you'll get a half animated overlay
  NSLog(@"applicationDidEnterBackground: setting keyz screen alpha to 1.");
  self.resignImageView.alpha = 1;

  NSLog(@"applicationDidEnterBackground: notifying go.");
  const bool requestTime = KeybaseAppDidEnterBackground();
  NSLog(@"applicationDidEnterBackground: after notifying go.");
  if (requestTime &&
      (!self.shutdownTask || self.shutdownTask == UIBackgroundTaskInvalid)) {
    UIApplication *app = [UIApplication sharedApplication];
    __weak __typeof__(self) weakSelf = self;
    self.shutdownTask = [app beginBackgroundTaskWithExpirationHandler:^{
      NSLog(@"applicationDidEnterBackground: shutdown task run.");
      KeybaseAppWillExit([[PushNotifier alloc] init]);
      __typeof__(self) strongSelf = weakSelf;
      if (strongSelf != nil) {
        [app endBackgroundTask:strongSelf.shutdownTask];
        strongSelf.shutdownTask = UIBackgroundTaskInvalid;
      }
    }];
    // The service can tell us to end this task early, so if it does, then
    // shutdown
    dispatch_async(
        dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^(void) {
          KeybaseAppBeginBackgroundTask([[PushNotifier alloc] init]);
          __typeof__(self) strongSelf = weakSelf;
          if (strongSelf && strongSelf.shutdownTask &&
              strongSelf.shutdownTask != UIBackgroundTaskInvalid) {
            [app endBackgroundTask:strongSelf.shutdownTask];
            strongSelf.shutdownTask = UIBackgroundTaskInvalid;
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

- (BOOL)application:(UIApplication *)application
            openURL:(NSURL *)url
            options:
                (NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options {
  return [RCTLinkingManager application:application
                                openURL:url
                                options:options];
}

- (BOOL)application:(UIApplication *)application
    continueUserActivity:(nonnull NSUserActivity *)userActivity
      restorationHandler:
          (nonnull void (^)(NSArray<id<UIUserActivityRestoring>> *_Nullable))
              restorationHandler {
  return [RCTLinkingManager application:application
                   continueUserActivity:userActivity
                     restorationHandler:restorationHandler];
}

- (void)applicationDidReceiveMemoryWarning:(UIApplication *)application {
  KeybaseForceGC();
}

RNHWKeyboardEvent *hwKeyEvent = nil;
- (NSMutableArray<UIKeyCommand *> *)keyCommands {
  NSMutableArray *keys = [NSMutableArray new];
  if (hwKeyEvent == nil) {
    hwKeyEvent = [[RNHWKeyboardEvent alloc] init];
  }
  if ([hwKeyEvent isListening]) {
    [keys addObject:[UIKeyCommand keyCommandWithInput:@"\r"
                                        modifierFlags:0
                                               action:@selector(sendEnter:)]];
    [keys addObject:[UIKeyCommand
                        keyCommandWithInput:@"\r"
                              modifierFlags:UIKeyModifierShift
                                     action:@selector(sendShiftEnter:)]];
  }
  return keys;
}

- (void)sendEnter:(UIKeyCommand *)sender {
  // Detects user pressing the enter key
  [hwKeyEvent sendHWKeyEvent:@"enter"];
}
- (void)sendShiftEnter:(UIKeyCommand *)sender {
  // Detects user pressing the shift-enter combination
  [hwKeyEvent sendHWKeyEvent:@"shift-enter"];
}

@end
