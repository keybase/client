//
//  PushPrompt.m
//  Keybase
//
//  Created by Daniel Ayoub on 6/5/18.
//  Copyright © 2018 Keybase. All rights reserved.
//

#import "PushPrompt.h"
#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <UserNotifications/UserNotifications.h>

@implementation PushPrompt

#pragma mark - RCTBridgeModule

RCT_EXPORT_MODULE(PushPrompt);

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_EXPORT_METHOD(getHasShownPushPrompt:resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  UNUserNotificationCenter *current = UNUserNotificationCenter.currentNotificationCenter;
  [current getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings * _Nonnull settings) {
    if (settings.authorizationStatus == UNAuthorizationStatusNotDetermined) {
      resolve(NO);
      return;
    }
    resolve(YES);
    return;
  }];
}

@end
