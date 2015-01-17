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

@interface KBLoginView ()
@property KBTextField *usernameField;
@property KBSecureTextField *passwordField;
@property KBButton *loginButton;
@property KBButton *signUpButton;
@end

@interface KBSignupView ()
@property KBTextField *inviteField;
@property KBTextField *emailField;
@property KBTextField *usernameField;
@property KBTextField *passwordField;
@property KBButton *loginButton;
@property KBButton *signupButton;
@end

@implementation KBConnectView

- (void)viewInit {
  [super viewInit];
  GHWeakSelf gself = self;
  _loginView = [[KBLoginView alloc] init];
  _loginView.signUpButton.targetBlock = ^{
    [gself setLoginEnabled:NO animated:YES];
  };
  [self addSubview:_loginView];

  _signupView = [[KBSignupView alloc] init];
  _signupView.loginButton.targetBlock = ^{
    [gself setLoginEnabled:YES animated:YES];
  };

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;
    //y += [layout setFrame:CGRectMake(0, 0, size.width, 100) view:yself.logoView].size.height;

    [layout setFrame:CGRectMake(0, y, size.width, size.height - y) view:yself.loginView];
    [layout setFrame:CGRectMake(0, y, size.width, size.height - y) view:yself.signupView];
    return size;
  }];
}

- (void)setLoginEnabled:(BOOL)loginEnabled animated:(BOOL)animated {
  if (animated) {
    CATransition *transition = [CATransition animation];
    [transition setType:kCATransitionFade];
    self.animations = @{@"subviews": transition};

    [CATransaction begin];
    if (!loginEnabled) {
      [self.animator replaceSubview:_loginView with:_signupView];
    } else {
      [self.animator replaceSubview:_signupView with:_loginView];
    }
    [CATransaction commit];
  } else {
    if (loginEnabled) {
      [_signupView removeFromSuperview];
      [self addSubview:_loginView];
    } else {
      [_loginView removeFromSuperview];
      [self addSubview:_signupView];
    }
  }
}

@end

@implementation KBLoginView

- (void)viewInit {
  [super viewInit];
  GHWeakSelf gself = self;

  _usernameField = [[KBTextField alloc] init];
  _usernameField.placeholder = @"Email or Username";
  [self addSubview:_usernameField];

  _passwordField = [[KBSecureTextField alloc] init];
  _passwordField.placeholder = @"Passphrase";
  [self addSubview:_passwordField];

  _loginButton = [[KBButton alloc] init];
  _loginButton.text = @"Log In";
  _loginButton.targetBlock = ^{
    [gself login];
  };
  [self addSubview:_loginButton];

  _signUpButton = [KBButton buttonAsLinkWithText:@"Sign Up"];
  _signUpButton.alignment = NSLeftTextAlignment;
  [self addSubview:_signUpButton];

  _usernameField.nextKeyView = _passwordField;
  _passwordField.nextKeyView = _loginButton;
  _loginButton.nextKeyView = _usernameField;

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 60;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.usernameField].size.height + 10;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.passwordField].size.height + 40;

    y += [layout setFrame:CGRectMake(40, y, size.width - 80, 56) view:yself.loginButton].size.height;

    y += [layout setFrame:CGRectMake(40, y, 80, 30) view:yself.signUpButton].size.height;

    return CGSizeMake(size.width, y);
  }];
}

- (void)viewWillAppear:(BOOL)animated {
  [self.window makeFirstResponder:_usernameField];
}

- (void)login {
  KBRLogin *login = [[KBRLogin alloc] initWithClient:AppDelegate.client];

  NSString *username = self.usernameField.text;
  NSString *passphrase = self.passwordField.text;

  if ([NSString gh_isBlank:username]) {
    // TODO Become first responder
    [self setError:KBErrorAlert(@"You need to enter a username or email address.")];
    return;
  }

  if ([NSString gh_isBlank:passphrase]) {
    // TODO Become first responder
    [self setError:KBErrorAlert(@"You need to enter a password.")];
    return;
  }

  [self setInProgress:YES sender:self.loginButton];
  [login passphraseLoginWithIdentify:false username:username passphrase:passphrase completion:^(NSError *error) {
    [self setInProgress:NO sender:self.loginButton];
    if (error) {
      [[NSAlert alertWithError:error] beginSheetModalForWindow:self.window completionHandler:nil];
      return;
    }

    self.passwordField.text = nil;

    [AppDelegate.sharedDelegate checkStatus];
  }];
}

@end


@implementation KBSignupView

- (void)viewInit {
  [super viewInit];
  GHWeakSelf gself = self;

  _inviteField = [[KBTextField alloc] init];
  _inviteField.placeholder = @"Invite Code";
  _inviteField.text = @"202020202020202020202111";
  //[self addSubview:_inviteField];

  _emailField = [[KBTextField alloc] init];
  _emailField.placeholder = @"Email";
  [self addSubview:_emailField];

  _usernameField = [[KBTextField alloc] init];
  _usernameField.placeholder = @"Username";
  [self addSubview:_usernameField];

  _passwordField = [[KBTextField alloc] init];
  _passwordField.placeholder = @"Passphrase";
  [self addSubview:_passwordField];

  _signupButton = [[KBButton alloc] init];
  _signupButton.text = @"Sign Up";
  _signupButton.targetBlock = ^{
    [gself signup];
  };
  [self addSubview:_signupButton];

  _loginButton = [KBButton buttonAsLinkWithText:@"Log In"];
  _loginButton.alignment = NSLeftTextAlignment;
  [self addSubview:_loginButton];

  _usernameField.nextKeyView = _passwordField;
  _passwordField.nextKeyView = _loginButton;
  _loginButton.nextKeyView = _usernameField;

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 60;

    //y += [layout setFrame:CGRectMake(20, y, size.width - 40, 22) view:yself.inviteField].size.height + 10;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.emailField].size.height + 10;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.usernameField].size.height + 10;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.passwordField].size.height + 40;

    y += [layout setFrame:CGRectMake(40, y, size.width - 80, 56) view:yself.signupButton].size.height;

    y += [layout setFrame:CGRectMake(40, y, 80, 30) view:yself.loginButton].size.height + 30;


    return CGSizeMake(size.width, y);
  }];
}


- (void)signup {
  KBRSignup *signup = [[KBRSignup alloc] initWithClient:AppDelegate.client];

  NSString *email = [self.emailField.text gh_strip];
  NSString *username = [self.usernameField.text gh_strip];
  NSString *passphrase = self.passwordField.text;

  if ([NSString gh_isBlank:username]) {
    // TODO Become first responder
    [self setError:KBErrorAlert(@"You need to enter a username.")];
    return;
  }

  if ([NSString gh_isBlank:email]) {
    [self setError:KBErrorAlert(@"You need to enter an email address.")];
    return;
  }

  if ([NSString gh_isBlank:passphrase]) {
    [self setError:KBErrorAlert(@"You need to enter a password.")];
    return;
  }

  [self setInProgress:YES sender:self.signupButton];
  [signup signupWithEmail:email inviteCode:self.inviteField.text passphrase:passphrase username:username completion:^(NSError *error, KBSignupRes *res) {
    [self setInProgress:NO sender:self.signupButton];
    if (error) {
      [[NSAlert alertWithError:error] beginSheetModalForWindow:self.window completionHandler:nil];
      return;
    }

    self.passwordField.text = nil;
    [AppDelegate.sharedDelegate checkStatus];
  }];
}

@end
