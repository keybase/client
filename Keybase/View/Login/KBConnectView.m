//
//  KBConnectView.m
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBConnectView.h"

#import "KBAppKit.h"
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
  [self addSubview:_loginView];

  _signupView = [[KBSignupView alloc] init];
  _signupView.loginButton.targetBlock = ^{
    [gself showLogin:YES];
  };
  [self addSubview:_signupView];
  _signupView.hidden = YES;
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
    //_loginView.usernameField.textField.editable = NO;
  } else {
    //_loginView.usernameField.textField.editable = YES;
  }
}

- (void)viewDidAppear:(BOOL)animated {
  if (!_loginView.hidden) {
    [_loginView viewDidAppear:animated];
    self.navigation.titleView.title = @"Keybase";
  }
  if (!_signupView.hidden) {
    [_signupView viewDidAppear:animated];
    self.navigation.titleView.title = @"Sign Up for Keybase";
  }
  _loginView.navigation = self.navigation;
  _signupView.navigation = self.navigation;
}

- (void)showLogin:(BOOL)animated {
  _loginView.hidden = NO;
  _signupView.hidden = YES;
  if (self.navigation) [self viewDidAppear:animated];
}

- (void)showSignup:(BOOL)animated {
  _loginView.hidden = YES;
  _signupView.hidden = NO;
  if (self.navigation) [self viewDidAppear:animated];
}

@end




