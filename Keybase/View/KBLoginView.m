//
//  KBLoginView.m
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBLoginView.h"

#import "KBUIDefines.h"
#import "AppDelegate.h"
#import "KBRPC.h"

#import "KBSignupView.h"
#import "KBKeyGenView.h"

@interface KBLoginView ()
@property KBTextLabel *titleLabel;
@property KBTextField *usernameField;
@property KBSecureTextField *passwordField;
@property KBButton *loginButton;
@property KBButton *signUpButton;
@end


@implementation KBLoginView

- (void)viewInit {
  [super viewInit];
  GHWeakSelf gself = self;

  _titleLabel = [[KBTextLabel alloc] init];
  [_titleLabel setText:@"Keybase" textAlignment:NSCenterTextAlignment];
  _titleLabel.font = [NSFont fontWithName:@"Helvetica Neue Thin" size:48];
  [self addSubview:_titleLabel];

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
  _signUpButton.targetBlock = ^{
    [gself signup];
  };
  [self addSubview:_signUpButton];

  _usernameField.nextKeyView = _passwordField;
  _passwordField.nextKeyView = _loginButton;
  _loginButton.nextKeyView = _usernameField;

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 40;

    y += [layout setFrame:CGRectMake(20, y, size.width - 40, 80) view:yself.titleLabel].size.height + 40;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.usernameField].size.height + 10;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.passwordField].size.height + 40;

    y += [layout setFrame:CGRectMake(40, y, size.width - 80, 56) view:yself.loginButton].size.height;

    y += [layout setFrame:CGRectMake(40, y, 80, 30) view:yself.signUpButton].size.height + 30;


    return CGSizeMake(size.width, 480);
  }];
}

- (void)viewWillAppear:(BOOL)animated {
  [self.window makeFirstResponder:_usernameField];
}

- (void)login {
  KBRLogin *login = [[KBRLogin alloc] initWithClient:AppDelegate.client];

  NSString *passphrase = self.passwordField.text;
  [self setInProgress:YES sender:self.loginButton];
  [login passphraseLoginWithIdentify:false username:self.usernameField.text passphrase:passphrase completion:^(NSError *error) {
    [self setInProgress:NO sender:self.loginButton];
    if (error) {
      [[NSAlert alertWithError:error] beginSheetModalForWindow:self.window completionHandler:nil];
      return;
    }

    self.passwordField.text = nil;

    KBKeyGenView *keyGenView = [[KBKeyGenView alloc] init];
    [self.navigationController pushView:keyGenView animated:YES];
  }];
}

- (void)signup {
  CATransition *transition = [CATransition animation];
  [transition setType:kCATransitionFade];

  KBSignupView *view = [[KBSignupView alloc] init];
  [self.navigationController pushView:view transition:transition transactionBlock:nil];
}


@end
