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
#import "KBTwitterConnectView.h"
#import "KBConnectView.h"
#import "KBLogoView.h"
#import "KBCatalogView.h"

@interface KBWindowController ()
@end

@implementation KBWindowController

- (void)windowDidLoad {
  self.window.styleMask = self.window.styleMask | NSFullSizeContentViewWindowMask;
  self.window.titleVisibility = NSWindowTitleHidden;
  self.window.titlebarAppearsTransparent = YES;
  self.window.movableByWindowBackground = YES;
  //self.window autorecalculatesKeyViewLoop = NO;

  [self.window setContentSize:CGSizeMake(KBDefaultWidth, KBDefaultHeight)];

  self.navigationController = [[KBNavigationController alloc] init];

  KBLogoView *logoView = [[KBLogoView alloc] initWithFrame:CGRectMake(0, 0, 360, 100)];
  logoView.backView.targetBlock = ^{
    [self.navigationController popViewAnimated:YES];
  };
  self.navigationController.titleView = logoView;

  self.window.contentView = self.navigationController.view;
}

- (void)showCatalog {
  [self window];
  KBCatalogView *catalogView = [[KBCatalogView alloc] init];
  [self.navigationController pushView:catalogView animated:NO];
  [self showWindow:nil];
}

- (void)showUser:(KBUserInfo *)userInfo animated:(BOOL)animated {
  KBUserProfileView *userProfileView = [[KBUserProfileView alloc] init];
  [userProfileView loadUID:userInfo.uid];
  [self.navigationController pushView:userProfileView animated:animated];
  [self showWindow:nil];
}

- (void)showLogin:(BOOL)animated {
  //[self.windowController.window setLevel:NSStatusWindowLevel];

  KBConnectView *connectView = [[KBConnectView alloc] init];
  [self.navigationController pushView:connectView animated:animated];
  [self showWindow:nil];
}

- (void)showSignup:(BOOL)animated {
  KBConnectView *connectView = [[KBConnectView alloc] init];
  [connectView setLoginEnabled:NO animated:NO];
  [self.navigationController pushView:connectView animated:animated];
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
