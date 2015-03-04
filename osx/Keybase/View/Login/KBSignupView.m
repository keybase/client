//
//  KBSignupView.m
//  Keybase
//
//  Created by Gabriel on 2/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBSignupView.h"
#import "AppDelegate.h"
#import "KBStrengthLabel.h"
#import "KBKeySelectView.h"

@interface KBSignupView ()
@property KBTextField *inviteField;
@property KBTextField *passwordField;
@property KBTextField *passwordConfirmField;
@property KBLabel *usernameStatusLabel;
@property KBStrengthLabel *strengthLabel;
@property KBLabel *passwordConfirmLabel;
@end

@implementation KBSignupView

- (void)viewInit {
  [super viewInit];
  GHWeakSelf gself = self;

  //KBLabel *label = [[KBLabel alloc] init];
  //[label setMarkup:@"<p>Welcome to Keybase.</p>" font:[NSFont systemFontOfSize:20] color:[KBAppearance.currentAppearance textColor] alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  //[self addSubview:label];

  _inviteField = [[KBTextField alloc] init];
  _inviteField.placeholder = @"Invite Code";
  _inviteField.text = @"202020202020202020202111"; // TODO: Hardcoded
  //[contentView addSubview:_inviteField];

  _emailField = [[KBTextField alloc] init];
  _emailField.placeholder = @"Email";
  [self.contentView addSubview:_emailField];

  _usernameField = [[KBTextField alloc] init];
  _usernameField.placeholder = @"Username";
  _usernameField.textField.delegate = self;
  [self.contentView addSubview:_usernameField];

  _deviceNameField = [[KBTextField alloc] init];
  _deviceNameField.placeholder = @"Computer Name";
  _deviceNameField.textField.delegate = self;
  //_deviceNameField.text = [[NSHost currentHost] localizedName];
  [self.contentView addSubview:_deviceNameField];

  _passwordField = [[KBSecureTextField alloc] init];
  _passwordField.placeholder = @"Passphrase";
  _passwordField.textField.delegate = self;
  [self.contentView addSubview:_passwordField];

  _passwordConfirmField = [[KBSecureTextField alloc] init];
  _passwordConfirmField.placeholder = @"Confirm Passphrase";
  _passwordConfirmField.textField.delegate = self;
  [self.contentView addSubview:_passwordConfirmField];

  _signupButton = [KBButton buttonWithText:@"Sign Up" style:KBButtonStylePrimary];
  _signupButton.targetBlock = ^{
    [gself signup];
  };
  [self.contentView addSubview:_signupButton];

  _loginButton = [KBButton buttonWithText:@"Already have an account? Log In." style:KBButtonStyleLink];
  [self.contentView addSubview:_loginButton];

  _usernameStatusLabel = [[KBLabel alloc] init];
  [self.contentView addSubview:_usernameStatusLabel];

  _strengthLabel = [[KBStrengthLabel alloc] init];
  // TODO: Strength label interfers with caps lock view
  [self.contentView addSubview:_strengthLabel];

  _passwordConfirmLabel = [[KBLabel alloc] init];
  [self.contentView addSubview:_passwordConfirmLabel];

  YOSelf yself = self;
  self.contentView.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;
    CGFloat padding = 12;

    //y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:label].size.height + 40;

    //y += [layout setFrame:CGRectMake(20, y, size.width - 40, 22) view:yself.inviteField].size.height + 10;
    y += [layout centerWithSize:CGSizeMake(300, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.emailField].size.height + padding;

    y += [layout centerWithSize:CGSizeMake(300, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.usernameField].size.height;
    [layout setFrame:CGRectMake(size.width - 120 - 40, y - 22, 120, 24) view:yself.usernameStatusLabel];
    y += padding;

    y += [layout centerWithSize:CGSizeMake(300, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.passwordField].size.height;
    [layout setFrame:CGRectMake(size.width - 120 - 40, y - 22, 120, 24) view:yself.strengthLabel];
    y += padding;

    y += [layout centerWithSize:CGSizeMake(300, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.passwordConfirmField].size.height;
    [layout setFrame:CGRectMake(size.width - 120 - 40, y - 22, 120, 24) view:yself.passwordConfirmLabel];
    y += padding;

    y += [layout centerWithSize:CGSizeMake(300, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.deviceNameField].size.height;
    y += padding;

    y += 30;

    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.signupButton].size.height + 24;

    y += [layout setFrame:CGRectMake(0, y, size.width, 30) view:yself.loginButton].size.height;

    y += 20;

    return CGSizeMake(MIN(380, size.width), y);
  }];

//#ifdef DEBUG
//  self.emailField.text = @"gabrielh+gbrl38@gmail.com";
//  self.usernameField.text = @"gbrl38";
//  self.passwordField.text = @"toomanysecrets";
//  self.passwordConfirmField.text = @"toomanysecrets";
//  self.deviceNameField.text = @"Test";
//#endif
}

- (void)viewDidAppear:(BOOL)animated {
  [self.window recalculateKeyViewLoop];
  [self.window makeFirstResponder:_emailField];
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
  NSString *password = _passwordField.text;
  [_strengthLabel setPassword:password];
  [self setNeedsLayout];
}

- (BOOL)passwordConfirmed {
  if ([_passwordField.text gh_present] && [_passwordConfirmField.text gh_present] && ![_passwordConfirmField.text isEqualTo:_passwordField.text]) {
    [_passwordConfirmLabel setText:@"Mismatch" font:[NSFont systemFontOfSize:12] color:[KBAppearance.currentAppearance errorColor] alignment:NSRightTextAlignment];
    [self setNeedsLayout];
    return NO;
  } else {
    _passwordConfirmLabel.attributedText = nil;
    [self setNeedsLayout];
    return YES;
  }
}

- (void)checkUsername {
  NSString *userName = [_usernameField.text gh_strip];

  if (![userName gh_present]) {
    self.usernameStatusLabel.attributedText = nil;
    return;
  }

  GHWeakSelf gself = self;
  KBRSignupRequest *request = [[KBRSignupRequest alloc] initWithClient:self.client];
  [request checkUsernameAvailableWithUsername:userName completion:^(NSError *error) {
    if (error.code == 701) {
      [gself.usernameStatusLabel setText:@"Already taken" font:[NSFont systemFontOfSize:12] color:[KBAppearance.currentAppearance errorColor] alignment:NSRightTextAlignment];
    } else if (error) {
      GHErr(@"Error: %@", error);
      gself.usernameStatusLabel.attributedText = nil;
      [self setNeedsLayout];
      return;
    } else {
      [gself.usernameStatusLabel setText:@"OK" font:[NSFont systemFontOfSize:12] color:[KBAppearance.currentAppearance okColor] alignment:NSRightTextAlignment];
    }
    [self setNeedsLayout];
  }];
}

- (void)signup {
  NSString *email = [self.emailField.text gh_strip];
  NSString *username = [self.usernameField.text gh_strip];
  NSString *passphrase = self.passwordField.text;
  NSString *deviceName = [self.deviceNameField.text gh_strip];

  if ([NSString gh_isBlank:username]) {
    // TODO Become first responder
    [AppDelegate setError:KBErrorAlert(@"You need to enter a username.") sender:_usernameField];
    return;
  }

  if ([NSString gh_isBlank:email]) {
    [AppDelegate setError:KBErrorAlert(@"You need to enter an email address.") sender:_emailField];
    return;
  }

  if ([NSString gh_isBlank:passphrase]) {
    [AppDelegate setError:KBErrorAlert(@"You need to enter a passphrase.") sender:_passwordField];
    return;
  }

  if ([NSString gh_isBlank:deviceName]) {
    [AppDelegate setError:KBErrorAlert(@"You need to enter a device name.") sender:_deviceNameField];
    return;
  }

  if (passphrase.length < 12) {
    [AppDelegate setError:KBErrorAlert(@"Your passphrase needs to be at least 12 characters long.") sender:_passwordField];
    return;
  }

  if (![self passwordConfirmed]) {
    [AppDelegate setError:KBErrorAlert(@"Your passphrases don't match.") sender:_passwordField];
    return;
  }

  KBRSignupRequest *signup = [[KBRSignupRequest alloc] initWithClient:self.client];

  // We'll add PGP key later
  [self.client registerMethod:@"keybase.1.gpgUi.wantToAddGPGKey" sessionId:signup.sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    completion(nil, @(NO));
  }];

  [self.navigation setProgressEnabled:YES];
  [signup signupWithEmail:email inviteCode:self.inviteField.text passphrase:passphrase username:username deviceName:deviceName completion:^(NSError *error, KBRSignupRes *res) {
    [self.navigation setProgressEnabled:NO];
    if (error) {
      [AppDelegate setError:error sender:self];
      return;
    }

    // Clear all fields (esp password)
    self.passwordField.text = nil;
    self.passwordConfirmField.text = nil;
    self.emailField.text = nil;
    self.usernameField.text = nil;
    self.deviceNameField.text = nil;
    self.usernameStatusLabel.attributedText = nil;
    self.strengthLabel.attributedText = nil;

    KBRConfigRequest *config = [[KBRConfigRequest alloc] initWithClient:self.client];
    [config getCurrentStatus:^(NSError *error, KBRGetCurrentStatusRes *status) {
      if (error) {
        [AppDelegate setError:error sender:self];
        return;
      }
      [self.delegate signupView:self didSignupWithStatus:status];
    }];
  }];
}

@end
