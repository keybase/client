//
//  KBConnectWindowController.m
//  Keybase
//
//  Created by Gabriel on 12/22/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "KBWindowController.h"
#import "KBUIDefines.h"

#import "KBUserProfileView.h"
#import "KBKeyGenView.h"
#import "KBProveView.h"
#import "KBLogoView.h"
#import "KBCatalogView.h"
#import "KBUsersView.h"
#import "AppDelegate.h"

@interface KBWindowController ()
@property KBConnectView *connectView;
@end

@implementation KBWindowController

- (void)windowDidLoad {
  self.window.styleMask = self.window.styleMask | NSFullSizeContentViewWindowMask;
  self.window.titleVisibility = NSWindowTitleHidden;
  self.window.titlebarAppearsTransparent = YES;
  self.window.movableByWindowBackground = YES;

  [self.window setContentSize:CGSizeMake(KBDefaultWidth, KBDefaultHeight)];

  self.navigation = [[KBNavigationView alloc] init];

  KBLogoView *logoView = [[KBLogoView alloc] initWithFrame:CGRectMake(0, 0, 360, 100)];
  logoView.backView.targetBlock = ^{
    [self.navigation popViewAnimated:YES];
  };
  self.navigation.titleView = logoView;

  self.window.contentView = self.navigation;

  _connectView = [[KBConnectView alloc] init];
  _connectView.loginView.delegate = self;
  _connectView.signupView.delegate = self;
}

- (void)signupView:(KBSignupView *)signupView didSignupWithStatus:(KBRGetCurrentStatusRes *)status {
  AppDelegate.sharedDelegate.status = status;
}

- (void)loginView:(KBLoginView *)loginView didLoginWithStatus:(KBRGetCurrentStatusRes *)status {
  AppDelegate.sharedDelegate.status = status;
}

- (void)showLogin:(BOOL)animated {
  //[self.windowController.window setLevel:NSStatusWindowLevel];
  [_connectView showLogin:animated];
  [self.navigation pushView:_connectView animated:animated];
  [self showWindow:nil];
}

- (void)showSignup:(BOOL)animated {
  _connectView = [[KBConnectView alloc] initWithFrame:CGRectMake(0, 0, KBDefaultWidth, KBDefaultHeight)];
  [_connectView showSignup:animated];
  [self.navigation pushView:_connectView animated:animated];
  [self showWindow:nil];
}

- (void)showKeyGen:(BOOL)animated {
  KBKeyGenView *keyGenView = [[KBKeyGenView alloc] init];
  [self.navigation pushView:keyGenView animated:animated];
  [self showWindow:nil];
}

- (void)showTwitterConnect:(BOOL)animated {
  KBProveView *twitterView = [[KBProveView alloc] init];
  [self.navigation pushView:twitterView animated:animated];
  [self showWindow:nil];
}

- (void)showUsers:(BOOL)animated {
  KBUsersView *usersView = [[KBUsersView alloc] init];
  [self.navigation pushView:usersView animated:animated];
  [self showWindow:nil];
}

- (void)showUser:(KBRUser *)user animated:(BOOL)animated {
  KBUserProfileView *userProfileView = [[KBUserProfileView alloc] init];
  [userProfileView setUser:user track:YES];
  [self.navigation setView:userProfileView transitionType:KBNavigationTransitionTypeFade];
  [self showWindow:nil];
}

@end
