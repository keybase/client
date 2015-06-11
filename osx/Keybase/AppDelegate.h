//
//  AppDelegate.h
//  Keybase
//
//  Created by Gabriel on 12/11/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <Cocoa/Cocoa.h>

//#import <KBKit/KBKit.h>
#import <KBKit/KBApp.h>
#import <KBKit/KBAppActions.h>
#import <KBKit/KBNotifications.h>
#import <KBKit/KBWorkspace.h>


@interface AppDelegate : NSObject <KBAppDelegate>

@property IBOutlet KBAppActions *appActions;

+ (instancetype)sharedDelegate;

@end
