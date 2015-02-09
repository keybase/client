//
//  KBConnectView.m
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBConnectView.h"

#import "KBUIDefines.h"
#import "AppDelegate.h"
#import "KBRPC.h"

#import "KBLogoView.h"
#import "KBKeyGenView.h"

@interface KBConnectView ()
//@property KBLogoView *logoView;
@property KBLoginView *loginView;
@property KBSignupView *signupView;
@end

@implementation KBConnectView

- (void)viewInit {
  [super viewInit];
  self.wantsLayer = YES;
  self.layer.backgroundColor = NSColor.whiteColor.CGColor;

  GHWeakSelf gself = self;
  _loginView = [[KBLoginView alloc] init];
  _loginView.signupButton.targetBlock = ^{
    [gself showSignup:YES];
  };

  _signupView = [[KBSignupView alloc] init];
  _signupView.loginButton.targetBlock = ^{
    [gself showLogin:YES];
  };
}

- (void)layout {
  [super layout];
  _loginView.frame = self.bounds;
  _signupView.frame = self.bounds;
}

- (void)openWindow:(NSString *)title {
  if (self.window) {
    [self.window makeKeyAndOrderFront:nil];
    return;
  }

  [self removeFromSuperview]; // TODO
  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:self];
  NSWindow *window = [KBWindow windowWithContentView:navigation size:CGSizeMake(360, 420) retain:YES];
  navigation.titleView = [KBTitleView titleViewWithTitle:title navigation:navigation];
  [window setLevel:NSFloatingWindowLevel];
  [window makeKeyAndOrderFront:nil];
}

- (void)setUser:(KBRUser *)user {
  if (user && [user.username gh_present]) {
    _loginView.usernameField.text = user.username;
    _loginView.usernameField.textField.editable = NO;
  } else {
    _loginView.usernameField.textField.editable = YES;
  }
}

- (void)showLogin:(BOOL)animated {
  if (![_loginView.usernameField.text gh_present]) _loginView.usernameField.text = _signupView.usernameField.text;
//  if (![_loginView.passwordField.text gh_present]) _loginView.passwordField.text = _signupView.passwordField.text;
  [self swapView:_loginView animated:animated];
}

- (void)showSignup:(BOOL)animated {
  if (![_signupView.usernameField.text gh_present]) _signupView.usernameField.text = _loginView.usernameField.text;
//  if (![_signupView.passwordField.text gh_present])_signupView.passwordField.text = _loginView.passwordField.text;
//  if (![_signupView.passwordConfirmField.text gh_present]) _signupView.passwordConfirmField.text = _loginView.passwordField.text;
  [self swapView:_signupView animated:animated];
}

@end




