//
//  AppDelegate.h
//  Keybase
//
//  Created by Gabriel on 12/11/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <Cocoa/Cocoa.h>

#import <KBKit/KBApp.h>


@interface AppDelegate : NSObject <KBAppDelegate>

@property IBOutlet KBApp *app;

+ (instancetype)sharedDelegate;

@end
