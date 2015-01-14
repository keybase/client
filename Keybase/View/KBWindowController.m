//
//  KBConnectWindowController.m
//  Keybase
//
//  Created by Gabriel on 12/22/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "KBWindowController.h"
#import "KBUIDefines.h"

#import "KBLoginView.h"
#import "KBUserProfileView.h"
#import "KBKeyGenView.h"
#import "KBTwitterConnectView.h"
#import "KBSignupView.h"

@interface KBWindowController ()
@end

@implementation KBWindowController

- (void)windowDidLoad {
  self.window.backgroundColor = NSColor.whiteColor;
  [self.window setContentSize:CGSizeMake(KBDefaultWidth, KBDefaultHeight)];
}

- (void)showUser:(KBUserInfo *)userInfo animated:(BOOL)animated {
  KBUserProfileView *userProfileView = [[KBUserProfileView alloc] init];
  [userProfileView loadUID:userInfo.uid];
  [self.navigationController pushView:userProfileView animated:animated];
  [self showWindow:nil];
}

- (void)showLogin:(BOOL)animated {
  //[self.windowController.window setLevel:NSStatusWindowLevel];
  KBLoginView *loginView = [[KBLoginView alloc] init];
  [self.navigationController pushView:loginView animated:animated];
  [self showWindow:nil];
}

- (void)showSignup:(BOOL)animated {
  KBSignupView *signupView = [[KBSignupView alloc] init];
  [self.navigationController pushView:signupView animated:animated];
  [self showWindow:nil];
}

- (void)showKeyGen:(BOOL)animated {
  KBKeyGenView *keyGenView = [[KBKeyGenView alloc] init];
  [self.navigationController pushView:keyGenView animated:animated];
  [self showWindow:nil];
}

- (void)showTwitterConnect:(BOOL)animated {
  KBTwitterConnectView *twitterView = [[KBTwitterConnectView alloc] init];
  [self.navigationController pushView:twitterView animated:animated];
  [self showWindow:nil];
}

@end
