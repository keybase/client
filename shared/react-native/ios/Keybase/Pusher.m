//
//  Pusher.m
//  Keybase
//
//  Created by Michael Maxim on 5/7/18.
//  Copyright © 2018 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "Pusher.h"
@import UserNotifications;

@implementation PushNotifier {
}
- (void)localNotification:(NSString*)ident msg:(NSString*)msg badgeCount:(long)badgeCount soundName:(NSString*)soundName convID:(NSString*)convID typ:(NSString*)typ {
  UNMutableNotificationContent *localNotification = [UNMutableNotificationContent new];
  localNotification.sound = [UNNotificationSound soundNamed:soundName];
  NSNumber* badge = NULL;
  if (badgeCount >= 0) {
    badge = [NSNumber numberWithLong:badgeCount];
  }
  localNotification.badge = badge;
  localNotification.body = msg;
  localNotification.userInfo = @{ @"convID" : convID, @"type" : typ};
  UNNotificationRequest *request = [UNNotificationRequest requestWithIdentifier:ident content:localNotification trigger:nil];
  UNUserNotificationCenter* center = [UNUserNotificationCenter currentNotificationCenter];
  [center addNotificationRequest:request withCompletionHandler:^(NSError * _Nullable error) {
    if (error != nil) {
      NSLog(@"local notification failed: %@",error);
    }
  }];
}

@end

