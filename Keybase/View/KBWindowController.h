//
//  KBConnectWindowController.h
//  Keybase
//
//  Created by Gabriel on 12/22/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <Cocoa/Cocoa.h>

#import "KBNavigationController.h"
#import "KBRPC.h"

@interface KBWindowController : NSWindowController

@property IBOutlet NSWindow *window;

@property KBNavigationController *navigationController;

- (void)showLogin:(BOOL)animated;
- (void)showSignup:(BOOL)animated;

- (void)showKeyGen:(BOOL)animated;

- (void)showTwitterConnect:(BOOL)animated;

- (void)showUser:(KBUserInfo *)userInfo animated:(BOOL)animated;

- (void)showCatalog;

@end
