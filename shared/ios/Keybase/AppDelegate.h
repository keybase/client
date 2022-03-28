//
//  AppDelegate.h
//  Keybase
//
//  Created by Chris Nojima on 9/28/16.
//  Copyright © 2016 Keybase. All rights reserved.
//

#import "CocoaLumberjack.h"
#import <Expo/Expo.h>
#import <React/RCTBridgeDelegate.h>
#import <UIKit/UIKit.h>
#import <UserNotifications/UNUserNotificationCenter.h>

@class Engine;

@interface AppDelegate
    : EXAppDelegateWrapper <UIApplicationDelegate, RCTBridgeDelegate,
                            UNUserNotificationCenterDelegate>

@property(nonatomic, strong) UIWindow *window;
@property(nonatomic, strong) Engine *engine;
@property(nonatomic, strong) DDFileLogger *fileLogger;
@property UIImageView *resignImageView;

@end
