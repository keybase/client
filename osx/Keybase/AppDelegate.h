//
//  AppDelegate.h
//  Keybase
//
//  Created by Gabriel on 12/11/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <Cocoa/Cocoa.h>

#import <KBKit/KBApp.h>
#import <KBKit/KBAppActions.h>

@interface AppDelegate : NSObject <KBAppDelegate>

@property IBOutlet KBAppActions *appActions;

+ (instancetype)sharedDelegate;

@end
