// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// Modified from https://github.com/julienXX/terminal-notifier
// Modified from https://github.com/vjeantet/alerter

#import <Cocoa/Cocoa.h>
#import <objc/runtime.h>

NSString *_fakeBundleIdentifier = nil;
@implementation NSBundle (FakeBundleIdentifier)
- (NSString *)__bundleIdentifier {
  if (self == [NSBundle mainBundle]) {
    return _fakeBundleIdentifier ? _fakeBundleIdentifier : @"com.apple.Terminal";
  } else {
    return [self __bundleIdentifier];
  }
}
@end

static BOOL installFakeBundleIdentifierHook() {
  Class class = objc_getClass("NSBundle");
  if (class) {
    method_exchangeImplementations(class_getInstanceMethod(class, @selector(bundleIdentifier)), class_getInstanceMethod(class, @selector(__bundleIdentifier)));
    return YES;
  }
  return NO;
}

@interface NotificationDelegate : NSObject <NSUserNotificationCenterDelegate>
@property NSTimeInterval timeout;
@property (retain) NSString *uuid;
@end

CFStringRef deliverNotification(CFStringRef titleRef, CFStringRef subtitleRef, CFStringRef messageRef, CFStringRef appIconURLStringRef,
  CFArrayRef actionsRef, CFStringRef bundleIDRef, CFStringRef groupIDRef, NSTimeInterval timeout) {

  if (bundleIDRef) {
    _fakeBundleIdentifier = (NSString *)bundleIDRef;
  }
  installFakeBundleIdentifierHook();

  NSUserNotification *userNotification = [[NSUserNotification alloc] init];
  userNotification.title = (NSString *)titleRef;
  userNotification.subtitle = (NSString *)subtitleRef;
  userNotification.informativeText = (NSString *)messageRef;
  NSMutableDictionary *options = [NSMutableDictionary dictionary];
  if (groupIDRef) {
    options[@"groupID"] = (NSString *)groupIDRef;
  }
  NSString *uuid = [[NSUUID UUID] UUIDString];
  options[@"uuid"] = uuid;
  userNotification.userInfo = options;
  if (appIconURLStringRef) {
    NSURL *appIconURL = [NSURL URLWithString:(NSString *)appIconURLStringRef];
    NSImage *image = [[NSImage alloc] initWithContentsOfURL:appIconURL];
    if (image) {
      [userNotification setValue:image forKey:@"_identityImage"];
      [userNotification setValue:@(false) forKey:@"_identityImageHasBorder"];
    }
  }
  NSArray *actions = (NSArray *)actionsRef;
  if ([actions count] >= 1) {
    [userNotification setValue:@YES forKey:@"_showsButtons"];
    if ([actions count] >= 2) {
      [userNotification setValue:@YES forKey:@"_alwaysShowAlternateActionMenu"];
      [userNotification setValue:actions forKey:@"_alternateActionButtonTitles"];
    } else {
      userNotification.actionButtonTitle = [actions objectAtIndex:0];
    }
  }

  NSUserNotificationCenter *userNotificationCenter = [NSUserNotificationCenter defaultUserNotificationCenter];
  //NSLog(@"Deliver: %@", userNotification);
  NotificationDelegate *delegate = [[NotificationDelegate alloc] init];
  delegate.timeout = timeout;
  delegate.uuid = uuid;
  userNotificationCenter.delegate = delegate;
  [userNotificationCenter deliverNotification:userNotification];

  [[NSRunLoop mainRunLoop] run];

  return nil;
}

@implementation NotificationDelegate

- (BOOL)userNotificationCenter:(NSUserNotificationCenter *)center shouldPresentNotification:(NSUserNotification *)userNotification {
  return YES;
}

- (void)remove:(NSUserNotification *)userNotification center:(NSUserNotificationCenter *)center {
  dispatch_async(dispatch_get_main_queue(), ^{
      [center removeDeliveredNotification:userNotification];
      dispatch_async(dispatch_get_main_queue(), ^{
        fflush(stdout);
        fflush(stderr);
        exit(0);
      });
    });
}

- (NSString *)JSON:(NSDictionary *)dict {
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:dict options:0 error:nil];
  if (!jsonData) return @"";
  return [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
}

- (void)userNotificationCenter:(NSUserNotificationCenter *)center didDeliverNotification:(NSUserNotification *)userNotification {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSDate *start = [NSDate date];
    while (-[start timeIntervalSinceNow] < self.timeout) {
      bool found = NO;
      for (NSUserNotification *deliveredNotification in [[NSUserNotificationCenter defaultUserNotificationCenter] deliveredNotifications]) {
        if ([deliveredNotification.userInfo[@"uuid"] isEqual:self.uuid]) {
          [NSThread sleepForTimeInterval:0.5];
          found = YES;
          break;
        }
      }
      if (!found) break;
    }
    [self remove:userNotification center:center];
  });
}

- (void)userNotificationCenter:(NSUserNotificationCenter *)center didActivateNotification:(NSUserNotification *)userNotification {
  switch (userNotification.activationType) {
    case NSUserNotificationActivationTypeAdditionalActionClicked:
    case NSUserNotificationActivationTypeActionButtonClicked: {
      NSString *action = nil;
      if ([[(NSObject*)userNotification valueForKey:@"_alternateActionButtonTitles"] count] > 1) {
        NSNumber *alternateActionIndex = [(NSObject*)userNotification valueForKey:@"_alternateActionIndex"];
        int actionIndex = [alternateActionIndex intValue];
        action = [(NSObject*)userNotification valueForKey:@"_alternateActionButtonTitles"][actionIndex];
      } else {
        action = userNotification.actionButtonTitle;
      }
      NSLog(@"%@", [self JSON:@{@"action": action}]);
      break;
    }
    case NSUserNotificationActivationTypeContentsClicked:
      //NSLog(@"contents");
      break;
    case NSUserNotificationActivationTypeReplied:
      //NSLog(@"replied");
      break;
    case NSUserNotificationActivationTypeNone:
      //NSLog(@"none");
      break;
  }
  [self remove:userNotification center:center];
}

@end
