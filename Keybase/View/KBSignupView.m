//
//  KBSignupView.m
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBSignupView.h"

#import "KBUIDefines.h"
#import "AppDelegate.h"
#import "KBRPC.h"
#import "KBLoginView.h"

@interface KBSignupView ()
@property KBTextLabel *titleLabel;
@property KBTextField *inviteField;
@property KBTextField *emailField;
@property KBTextField *usernameField;
@property KBTextField *passwordField;
@property KBButton *loginButton;
@property KBButton *signupButton;
@end


@implementation KBSignupView

- (void)viewInit {
  [super viewInit];
  GHWeakSelf gself = self;

  _titleLabel = [[KBTextLabel alloc] init];
  _titleLabel.text = @"Keybase";
  _titleLabel.textAlignment = NSCenterTextAlignment;
  _titleLabel.font = [NSFont fontWithName:@"Helvetica Neue Thin" size:48];
  [self addSubview:_titleLabel];

  _inviteField = [[KBTextField alloc] init];
  _inviteField.placeholderString = @"Invite Code";
  _inviteField.stringValue = @"202020202020202020202111";
  //[self addSubview:_inviteField];

  _emailField = [[KBTextField alloc] init];
  _emailField.placeholderString = @"Email";
  [self addSubview:_emailField];

  _usernameField = [[KBTextField alloc] init];
  _usernameField.placeholderString = @"Username";
  [self addSubview:_usernameField];

  _passwordField = [[KBTextField alloc] init];
  _passwordField.placeholderString = @"Passphrase";
  [self addSubview:_passwordField];

  _signupButton = [[KBButton alloc] init];
  _signupButton.text = @"Sign Up";
  _signupButton.targetBlock = ^{
    [gself signup];
  };
  [self addSubview:_signupButton];

  _loginButton = [KBButton buttonAsLinkWithText:@"Sign Up"];
  _loginButton.targetBlock = ^{
    [gself login];
  };
  [self addSubview:_loginButton];

  _usernameField.nextKeyView = _passwordField;
  _passwordField.nextKeyView = _loginButton;
  _loginButton.nextKeyView = _usernameField;

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 40;

    y += [layout setFrame:CGRectMake(20, y, size.width - 40, 80) view:yself.titleLabel].size.height + 40;

    //y += [layout setFrame:CGRectMake(20, y, size.width - 40, 22) view:yself.inviteField].size.height + 10;
    y += [layout setFrame:CGRectMake(20, y, size.width - 40, 22) view:yself.emailField].size.height + 10;
    y += [layout setFrame:CGRectMake(20, y, size.width - 40, 22) view:yself.usernameField].size.height + 10;
    y += [layout setFrame:CGRectMake(20, y, size.width - 40, 22) view:yself.passwordField].size.height + 40;

    y += [layout setFrame:CGRectMake(20, y, size.width - 40, 56) view:yself.signupButton].size.height;

    y += [layout setFrame:CGRectMake(20, y, 80, 30) view:yself.loginButton].size.height + 30;


    return CGSizeMake(size.width, 480);
  }];
}


- (void)signup {
  KBRSignup *signup = [[KBRSignup alloc] initWithClient:AppDelegate.client];

  NSString *passphrase = self.passwordField.stringValue;

  [self setInProgress:YES sender:self.signupButton];
  [signup signupWithEmail:self.emailField.stringValue inviteCode:self.inviteField.stringValue passphrase:passphrase username:self.usernameField.stringValue completion:^(NSError *error, KBSignupRes *res) {
    [self setInProgress:NO sender:self.signupButton];
    if (error) {
      [[NSAlert alertWithError:error] beginSheetModalForWindow:self.window completionHandler:nil];
      return;
    }

    self.passwordField.stringValue = @"";
    [AppDelegate.client checkStatus];
  }];
}

- (IBAction)login {
  CATransition *transition = [CATransition animation];
  [transition setType:kCATransitionFade];

  KBLoginView *loginView = [[KBLoginView alloc] init];
  [self.navigationController pushView:loginView transition:transition transactionBlock:nil];
}

@end

