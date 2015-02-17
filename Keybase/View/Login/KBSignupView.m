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

  _inviteField = [[KBTextField alloc] init];
  _inviteField.placeholder = @"Invite Code";
  _inviteField.text = @"202020202020202020202111"; // TODO: Hardcoded
  //[self addSubview:_inviteField];

  _emailField = [[KBTextField alloc] init];
  _emailField.placeholder = @"Email";
  [self addSubview:_emailField];

  _usernameField = [[KBTextField alloc] init];
  _usernameField.placeholder = @"Username";
  _usernameField.textField.delegate = self;
  [self addSubview:_usernameField];

  _deviceNameField = [[KBTextField alloc] init];
  _deviceNameField.placeholder = @"Computer Name";
  _deviceNameField.textField.delegate = self;
  //_deviceNameField.text = [[NSHost currentHost] localizedName];
  [self addSubview:_deviceNameField];

  _passwordField = [[KBSecureTextField alloc] init];
  _passwordField.placeholder = @"Passphrase";
  _passwordField.textField.delegate = self;
  [self addSubview:_passwordField];

  _passwordConfirmField = [[KBSecureTextField alloc] init];
  _passwordConfirmField.placeholder = @"Confirm Passphrase";
  _passwordConfirmField.textField.delegate = self;
  [self addSubview:_passwordConfirmField];

  _signupButton = [KBButton buttonWithText:@"Sign Up" style:KBButtonStylePrimary];
  _signupButton.targetBlock = ^{
    [gself signup];
  };
  [self addSubview:_signupButton];

  _loginButton = [KBButton buttonWithText:@"Already have an account? Log In." style:KBButtonStyleLink];
  [self addSubview:_loginButton];

  _usernameStatusLabel = [[KBLabel alloc] init];
  [self addSubview:_usernameStatusLabel];

  _strengthLabel = [[KBStrengthLabel alloc] init];
  // TODO: Strength label interfers with caps lock view
  [self addSubview:_strengthLabel];

  _passwordConfirmLabel = [[KBLabel alloc] init];
  [self addSubview:_passwordConfirmLabel];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 40;

    //y += [layout setFrame:CGRectMake(20, y, size.width - 40, 22) view:yself.inviteField].size.height + 10;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.emailField].size.height + 10;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.usernameField].size.height;
    [layout setFrame:CGRectMake(size.width - 120 - 40, y - 22, 120, 24) view:yself.usernameStatusLabel];
    y += 10;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.passwordField].size.height;
    [layout setFrame:CGRectMake(size.width - 120 - 40, y - 22, 120, 24) view:yself.strengthLabel];
    y += 10;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.passwordConfirmField].size.height;
    [layout setFrame:CGRectMake(size.width - 120 - 40, y - 22, 120, 24) view:yself.passwordConfirmLabel];
    y += 10;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.deviceNameField].size.height;
    y += 10;

    y += 30;

    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.signupButton].size.height + 30;

    y += [layout setFrame:CGRectMake(0, y, size.width, 30) view:yself.loginButton].size.height;

    y += 40;

    return CGSizeMake(size.width, y);
  }];
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
    [_passwordConfirmLabel setText:@"Mismatch" font:[NSFont systemFontOfSize:12] color:[KBLookAndFeel errorColor] alignment:NSRightTextAlignment];
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
  KBRSignupRequest *request = [[KBRSignupRequest alloc] initWithClient:AppDelegate.client];
  [request checkUsernameAvailableWithUsername:userName completion:^(NSError *error) {
    if (error.code == 701) {
      [gself.usernameStatusLabel setText:@"Already taken" font:[NSFont systemFontOfSize:12] color:[KBLookAndFeel errorColor] alignment:NSRightTextAlignment];
    } else if (error) {
      GHErr(@"Error: %@", error);
      gself.usernameStatusLabel.attributedText = nil;
      [self setNeedsLayout];
      return;
    } else {
      [gself.usernameStatusLabel setText:@"OK" font:[NSFont systemFontOfSize:12] color:[KBLookAndFeel okColor] alignment:NSRightTextAlignment];
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

  KBRSignupRequest *signup = [[KBRSignupRequest alloc] initWithClient:AppDelegate.client];

  [AppDelegate.client registerMethod:@"keybase.1.gpgUi.selectKey" owner:self requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRSelectKeyRes *response = [[KBRSelectKeyRes alloc] init];
    completion(nil, response);
  }];

  [AppDelegate.client registerMethod:@"keybase.1.gpgUi.wantToAddGPGKey" owner:self requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    completion(nil, @(NO));
  }];

  [AppDelegate setInProgress:YES view:self];
  [self.navigation.titleView setProgressEnabled:YES];
  [signup signupWithEmail:email inviteCode:self.inviteField.text passphrase:passphrase username:username deviceName:deviceName completion:^(NSError *error, KBRSignupRes *res) {
    [AppDelegate setInProgress:NO view:self];
    [self.navigation.titleView setProgressEnabled:NO];
    if (error) {
      [AppDelegate setError:error sender:self];
      return;
    }

    [AppDelegate.client unregister:self];

    // Clear all fields (esp password)
    self.passwordField.text = nil;
    self.passwordConfirmField.text = nil;
    self.emailField.text = nil;
    self.usernameField.text = nil;
    self.deviceNameField.text = nil;

    KBRConfigRequest *config = [[KBRConfigRequest alloc] initWithClient:AppDelegate.client];
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
