//
//  AppDelegate.h
//  Keybase
//
//  Created by Chris Nojima on 9/28/16.
//  Copyright © 2016 Keybase. All rights reserved.
//

#import <RCTAppDelegate.h>
#import <UserNotifications/UNUserNotificationCenter.h>
#import <UIKit/UIKit.h>
#import <Expo/Expo.h>
#import <KBCommon/KBCommon-Swift.h>

@class Engine;

@interface AppDelegate : EXAppDelegateWrapper

@property UIImageView *resignImageView;
@property(nonatomic, strong) NSDictionary *fsPaths;
@property UIBackgroundTaskIdentifier backgroundTask;
@property UIBackgroundTaskIdentifier shutdownTask;
@property(nonatomic, strong) ItemProviderHelper *iph;

@end
