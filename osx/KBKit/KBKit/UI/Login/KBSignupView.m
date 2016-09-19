//
//  KBSignupView.m
//  Keybase
//
//  Created by Gabriel on 2/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBSignupView.h"
//#import "KBStrengthLabel.h"
#import "KBDefines.h"
#import "KBPaperKeyDisplayView.h"

#import <CocoaLumberjack/CocoaLumberjack.h>
#import <YOLayout/YOLayout+PrefabLayouts.h>

@interface KBSignupView () <NSTextFieldDelegate, KBTextFieldFocusDelegate>
@property KBTextField *inviteField;
@property KBTextField *passwordField;
@property KBTextField *passwordConfirmField;
@property KBLabel *usernameStatusLabel;
//@property KBStrengthLabel *strengthLabel;
@property KBLabel *passwordConfirmLabel;
@property KBHoverView *popover;
@property NSView *popoverTarget;
@property KBTextField *focusedField;
@end

@implementation KBSignupView

- (void)viewInit {
  [super viewInit];
  GHWeakSelf gself = self;
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];

  YOView *contentView = [[YOView alloc] init];
  [self addSubview:contentView];

  [contentView kb_setBackgroundColor:NSColor.whiteColor];
  contentView.layer.borderColor = KBAppearance.currentAppearance.lineColor.CGColor;
  contentView.layer.borderWidth = 1.0;
  contentView.layer.cornerRadius = 6;

  //KBLabel *label = [[KBLabel alloc] init];
  //[label setMarkup:@"<p>Welcome to Keybase.</p>" font:[NSFont systemFontOfSize:20] color:[KBAppearance.currentAppearance textColor] alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  //[self addSubview:label];

  KBLabel *label = [[KBLabel alloc] init];
  [label setMarkup:@"<p><thin>Welcome to</thin> Keybase</p>" style:KBTextStyleHeader alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  [contentView addSubview:label];

  _inviteField = [[KBTextField alloc] init];
  _inviteField.placeholder = @"Invite Code";
  _inviteField.text = @"202020202020202020202020"; // TODO: Hardcoded
  //[contentView addSubview:_inviteField];

  _popover = [[KBHoverView alloc] init];

  _emailField = [[KBTextField alloc] init];
  _emailField.placeholder = @"Email";
  _emailField.attributes[@"title"] = @"Email Address";
  _emailField.attributes[@"info"] = @"Your email address can be used to help recover your account.";
  _emailField.focusDelegate = self;
  [contentView addSubview:_emailField];

  _usernameField = [[KBTextField alloc] init];
  _usernameField.placeholder = @"Username";
  _usernameField.textField.delegate = self;
  _usernameField.attributes[@"title"] = @"Username";
  _usernameField.attributes[@"info"] = @"This is a unique username that everyone will use to identify you. Choose wisely, this can't be changed.";
  _usernameField.focusDelegate = self;
  [contentView addSubview:_usernameField];

  _deviceNameField = [[KBTextField alloc] init];
  _deviceNameField.placeholder = @"Computer Name";
  _deviceNameField.textField.delegate = self;
  _deviceNameField.focusDelegate = self;
  _deviceNameField.attributes[@"title"] = @"Computer Name";
  _deviceNameField.attributes[@"info"] = @"We'll register the app with this name. It'll help you identify it later. For example, \"Work\" or \"Home\" or \"Macbook\".";

  //_deviceNameField.text = [[NSHost currentHost] localizedName];
  [contentView addSubview:_deviceNameField];

  _passwordField = [[KBSecureTextField alloc] init];
  _passwordField.placeholder = @"Passphrase";
  _passwordField.textField.delegate = self;
  _passwordField.focusDelegate = self;
  _passwordField.attributes[@"title"] = @"Passphrase";
  _passwordField.attributes[@"info"] = @"You'll need a 12 character random password. This is never sent to Keybase's servers. It's salted & stretched with scrypt here.";
  [contentView addSubview:_passwordField];

  _passwordConfirmField = [[KBSecureTextField alloc] init];
  _passwordConfirmField.placeholder = @"Confirm Passphrase";
  _passwordConfirmField.textField.delegate = self;
  _passwordConfirmField.focusDelegate = self;
  [contentView addSubview:_passwordConfirmField];

  _signupButton = [KBButton buttonWithText:@"Sign Up" style:KBButtonStylePrimary];
  _signupButton.targetBlock = ^{
    [gself signup];
  };
  [contentView addSubview:_signupButton];

  _loginButton = [KBButton buttonWithText:@"Already have an account? Log In." style:KBButtonStyleLink];
  [contentView addSubview:_loginButton];

  _usernameStatusLabel = [[KBLabel alloc] init];
  [contentView addSubview:_usernameStatusLabel];

//  _strengthLabel = [[KBStrengthLabel alloc] init];
//  // TODO: Strength label interfers with caps lock view
//  [contentView addSubview:_strengthLabel];

  _passwordConfirmLabel = [[KBLabel alloc] init];
  [contentView addSubview:_passwordConfirmLabel];

  YOSelf yself = self;
  contentView.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 30;
    CGFloat padding = 12;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:label].size.height + 30;

    //y += [layout setFrame:CGRectMake(20, y, size.width - 40, 22) view:yself.inviteField].size.height + 10;
    y += [layout centerWithSize:CGSizeMake(300, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.emailField].size.height + padding;

    y += [layout centerWithSize:CGSizeMake(300, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.usernameField].size.height;
    [layout setFrame:CGRectMake(size.width - 120 - 45, y - 22, 120, 24) view:yself.usernameStatusLabel];
    y += padding;

    y += [layout centerWithSize:CGSizeMake(300, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.passwordField].size.height;
//    [layout setFrame:CGRectMake(size.width - 120 - 45, y - 22, 120, 24) view:yself.strengthLabel];
    y += padding;

    y += [layout centerWithSize:CGSizeMake(300, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.passwordConfirmField].size.height;
    [layout setFrame:CGRectMake(size.width - 120 - 45, y - 22, 120, 24) view:yself.passwordConfirmLabel];
    y += padding;

    y += [layout centerWithSize:CGSizeMake(300, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.deviceNameField].size.height;
    y += padding;

    y += 30;

    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.signupButton].size.height + 24;

    y += [layout setFrame:CGRectMake(0, y, size.width, 30) view:yself.loginButton].size.height;

    y += 30;

    // TODO
    if (yself.popoverTarget) {
      [layout sizeToFitVerticalInFrame:CGRectMake(contentView.frame.origin.x + yself.popoverTarget.frame.origin.x + yself.popoverTarget.frame.size.width + 10, contentView.frame.origin.y + yself.popoverTarget.frame.origin.y - 20, (self.frame.size.width - size.width)/2.0, 0) view:yself.popover];
    }

    return CGSizeMake(MIN(380, size.width), y);
  }];

  self.viewLayout = [YOLayout center:contentView];
}

- (void)viewDidAppear:(BOOL)animated {
  [self.window recalculateKeyViewLoop];
  [self.window makeFirstResponder:_emailField];
}

- (void)textField:(KBTextField *)textField didChangeFocus:(BOOL)focused {
  if (focused && textField.attributes[@"title"]) {
    _focusedField = textField;
    [_popover setText:textField.attributes[@"info"] title:textField.attributes[@"title"]];
    _popoverTarget = textField;
    [_popover removeFromSuperview];
    [self layoutView]; // Force immediate layout
    [self addSubview:_popover positioned:NSWindowAbove relativeTo:nil];
  } else if (textField == _focusedField) {
    [_popover removeFromSuperview];
    _popoverTarget = nil;
  }
}

- (void)controlTextDidChange:(NSNotification *)notification {
  NSTextField *textField = [notification object];
  if (textField == _usernameField.textField) _usernameStatusLabel.attributedText = nil;
  else if (textField == _passwordField.textField) [self checkPassword];

  if (textField == _passwordField.textField || textField == _passwordConfirmField.textField) _passwordConfirmLabel.attributedText = nil;

  [self setNeedsLayout];
}

- (void)controlTextDidEndEditing:(NSNotification *)notification {
  NSTextField *textField = [notification object];
  if (textField == _usernameField.textField) [self checkUsername];
  [self passwordConfirmed];
}

- (void)checkPassword {
  //NSString *password = _passwordField.text;
  //[_strengthLabel setPassword:password];
  [self setNeedsLayout];
}

- (BOOL)passwordConfirmed {
  if ([_passwordField.text gh_present] && [_passwordConfirmField.text gh_present] && ![_passwordConfirmField.text isEqualTo:_passwordField.text]) {
    [_passwordConfirmLabel setText:@"Mismatch" font:[NSFont systemFontOfSize:12] color:KBAppearance.currentAppearance.dangerColor alignment:NSRightTextAlignment lineBreakMode:NSLineBreakByClipping];
    [self setNeedsLayout];
    return NO;
  } else {
    _passwordConfirmLabel.attributedText = nil;
    [self setNeedsLayout];
    return YES;
  }
}

- (void)checkUsername {
  NSString *username = [_usernameField.text gh_strip];

  if (![username gh_present]) {
    self.usernameStatusLabel.attributedText = nil;
    return;
  }

  GHWeakSelf gself = self;
  KBRSignupRequest *request = [[KBRSignupRequest alloc] initWithClient:self.client];
  [request checkUsernameAvailableWithUsername:username completion:^(NSError *error) {
    if (error.code == 701) {
      [gself.usernameStatusLabel setText:@"Already taken" font:[NSFont systemFontOfSize:12] color:KBAppearance.currentAppearance.dangerColor alignment:NSRightTextAlignment lineBreakMode:NSLineBreakByClipping];
    } else if (error) {
      DDLogError(@"Error checking username: %@", error);
      gself.usernameStatusLabel.attributedText = nil;
      [self setNeedsLayout];
      return;
    } else {
      [gself.usernameStatusLabel setText:@"OK" font:[NSFont systemFontOfSize:12] color:KBAppearance.currentAppearance.successColor alignment:NSRightTextAlignment lineBreakMode:NSLineBreakByClipping];
    }
    [self setNeedsLayout];
  }];
}

- (void)signup {
  NSString *email = [self.emailField.text gh_strip];
  NSString *username = [self.usernameField.text gh_strip];
  NSString *passphrase = self.passwordField.text;
  NSString *deviceName = [self.deviceNameField.text gh_strip];

  if ([NSString gh_isBlank:email]) {
    [KBActivity setError:KBErrorAlert(@"You need to enter an email address.") sender:_emailField];
    return;
  }
  
  if ([NSString gh_isBlank:username]) {
    // TODO Become first responder
    [KBActivity setError:KBErrorAlert(@"You need to enter a username.") sender:_usernameField];
    return;
  }

  if ([NSString gh_isBlank:passphrase]) {
    [KBActivity setError:KBErrorAlert(@"You need to enter a passphrase.") sender:_passwordField];
    return;
  }

  if ([NSString gh_isBlank:deviceName]) {
    [KBActivity setError:KBErrorAlert(@"You need to enter a device name.") sender:_deviceNameField];
    return;
  }

  if (passphrase.length < 12) {
    [KBActivity setError:KBErrorAlert(@"Your passphrase needs to be at least 12 characters long.") sender:_passwordField];
    return;
  }

  if (![self passwordConfirmed]) {
    [KBActivity setError:KBErrorAlert(@"Your passphrases don't match.") sender:_passwordField];
    return;
  }

  KBRSignupRequest *request = [[KBRSignupRequest alloc] initWithClient:self.client];

  // We'll add PGP key later
  [self.client registerMethod:@"keybase.1.gpgUi.wantToAddGPGKey" sessionId:request.sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    completion(nil, @(NO));
  }];

  [KBPaperKeyDisplayView registerDisplay:self.client sessionId:request.sessionId navigation:self.navigation];

  [self.navigation setProgressEnabled:YES];
  // TODO: Protocol changed
  /*
  [request signupWithEmail:email inviteCode:self.inviteField.text passphrase:passphrase username:username deviceName:deviceName storeSecret:NO skipMail:NO completion:^(NSError *error, KBRSignupRes *res) {
    [self.navigation setProgressEnabled:NO];
    if ([KBActivity setError:error sender:self]) return;

    // Clear all fields (esp password)
    self.passwordField.text = nil;
    self.passwordConfirmField.text = nil;
    self.emailField.text = nil;
    self.usernameField.text = nil;
    self.deviceNameField.text = nil;
    self.usernameStatusLabel.attributedText = nil;
    //self.strengthLabel.attributedText = nil;

    [self.delegate signupViewDidSignup:self];
    if (self.completion) self.completion(self);
  }];
   */
}

@end
