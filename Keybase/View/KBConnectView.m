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
#import "KBStrengthLabel.h"

@interface KBConnectView ()
//@property KBLogoView *logoView;
@property KBLoginView *loginView;
@property KBSignupView *signupView;
@end

@interface KBLoginView ()
@property KBTextField *usernameField;
@property KBSecureTextField *passwordField;
@property KBButton *loginButton;
@property KBButton *signupButton;
@end

@interface KBSignupView ()
@property KBTextField *inviteField;
@property KBTextField *emailField;
@property KBTextField *usernameField;
@property KBTextField *deviceNameField;
@property KBTextField *passwordField;
@property KBTextField *passwordConfirmField;
@property KBButton *loginButton;
@property KBButton *signupButton;
@property KBLabel *usernameStatusLabel;
@property KBStrengthLabel *strengthLabel;
@property KBLabel *passwordConfirmLabel;
@end

@implementation KBConnectView

- (void)viewInit {
  [super viewInit];

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

  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:self];
  NSWindow *window = [KBWindow windowWithContentView:navigation size:CGSizeMake(360, 420) retain:YES];
  navigation.titleView = [KBTitleView titleViewWithTitle:title navigation:navigation];
  [window setLevel:NSFloatingWindowLevel];
  [window makeKeyAndOrderFront:nil];
  [window layoutIfNeeded];
}

- (void)setUser:(KBRUser *)user {
  if (user) {
    _loginView.usernameField.text = user.username;
    _loginView.usernameField.textField.editable = NO;
  } else {
    _loginView.usernameField.textField.editable = YES;
  }
}

//- (NSString *)windowTitle {
//  return [_loginView superview] ? @"Log In" : @"Sign Up";
//}

- (void)showLogin:(BOOL)animated {
  [self swapView:_loginView animated:animated];
  if (![_loginView.usernameField.text gh_present]) _loginView.usernameField.text = _signupView.usernameField.text;
  if (![_loginView.passwordField.text gh_present]) _loginView.passwordField.text = _signupView.passwordField.text;
}

- (void)showSignup:(BOOL)animated {
  [self swapView:_signupView animated:animated];
  if (![_signupView.usernameField.text gh_present]) _signupView.usernameField.text = _loginView.usernameField.text;
  if (![_signupView.passwordField.text gh_present])_signupView.passwordField.text = _loginView.passwordField.text;
  if (![_signupView.passwordConfirmField.text gh_present]) _signupView.passwordConfirmField.text = _loginView.passwordField.text;
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

  _loginButton = [KBButton buttonWithText:@"Log In" style:KBButtonStylePrimary];
  _loginButton.targetBlock = ^{
    [gself login];
  };
  [_loginButton setKeyEquivalent:@"\r"];
  [self addSubview:_loginButton];

  _signupButton = [KBButton buttonWithText:@"Don't have an account? Sign Up" style:KBButtonStyleLink];
  [self addSubview:_signupButton];

  KBButton *forgotPasswordButton = [KBButton buttonWithText:@"Forgot my password" style:KBButtonStyleLink];
  [self addSubview:forgotPasswordButton];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 40;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.usernameField].size.height + 10;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.passwordField].size.height + 40;

    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.loginButton].size.height + 30;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width, 0) view:yself.signupButton].size.height + 20;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width, 0) view:forgotPasswordButton].size.height + 20;

    y += 20;

    return CGSizeMake(size.width, y);
  }];
}

- (void)viewDidAppear:(BOOL)animated {
  [self.window recalculateKeyViewLoop];
  [self.window makeFirstResponder:_usernameField];
}

- (void)login {
  KBRLoginRequest *login = [[KBRLoginRequest alloc] initWithClient:AppDelegate.client];

  NSString *username = self.usernameField.text;
  NSString *passphrase = self.passwordField.text;

  if ([NSString gh_isBlank:username]) {
    [self setError:KBErrorAlert(@"You need to enter a username or email address.") sender:_usernameField];
    return;
  }

  if ([NSString gh_isBlank:passphrase]) {
    [self setError:KBErrorAlert(@"You need to enter a password.") sender:_passwordField];
    return;
  }

  [self setInProgress:YES sender:nil];
  [login passphraseLoginWithIdentify:false username:username passphrase:passphrase completion:^(NSError *error) {
    [self setInProgress:NO sender:nil];
    if (error) {
      [self setError:error];
      return;
    }

    self.passwordField.text = nil;

    KBRConfigRequest *config = [[KBRConfigRequest alloc] initWithClient:AppDelegate.client];
    [config getCurrentStatus:^(NSError *error, KBRGetCurrentStatusRes *status) {
      if (error) {
        [self setError:error];
        return;
      }
      [self.delegate loginView:self didLoginWithStatus:status];
    }];
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

  [AppDelegate.client registerMethod:@"keybase.1.gpgUi.selectKey" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRSelectKeyRes *response = [[KBRSelectKeyRes alloc] init];
    completion(nil, response);
  }];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 40;

    //y += [layout setFrame:CGRectMake(20, y, size.width - 40, 22) view:yself.inviteField].size.height + 10;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.emailField].size.height + 10;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.usernameField].size.height;
    [layout setFrame:CGRectMake(size.width - 80 - 40, y - 22, 80, 24) view:yself.usernameStatusLabel];
    y += 10;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.passwordField].size.height;
    [layout setFrame:CGRectMake(size.width - 80 - 40, y - 22, 80, 24) view:yself.strengthLabel];
    y += 10;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.passwordConfirmField].size.height;
    [layout setFrame:CGRectMake(size.width - 80 - 40, y - 22, 80, 24) view:yself.passwordConfirmLabel];
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
  else if (textField != _passwordConfirmField.textField) [self passwordConfirmed];
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
  [AppDelegate.APIClient checkForUserName:userName success:^(BOOL exists) {
    if (!exists) {
      [gself.usernameStatusLabel setText:@"OK" font:[NSFont systemFontOfSize:12] color:[KBLookAndFeel okColor] alignment:NSRightTextAlignment];
    } else {
      [gself.usernameStatusLabel setText:@"Already taken" font:[NSFont systemFontOfSize:12] color:[KBLookAndFeel errorColor] alignment:NSRightTextAlignment];
    }
    [self setNeedsLayout];
  } failure:^(NSError *error) {
    GHErr(@"Error: %@", error);
    gself.usernameStatusLabel.attributedText = nil;
    [self setNeedsLayout];
  }];
}

- (void)signup {
  KBRSignupRequest *signup = [[KBRSignupRequest alloc] initWithClient:AppDelegate.client];

  NSString *email = [self.emailField.text gh_strip];
  NSString *username = [self.usernameField.text gh_strip];
  NSString *passphrase = self.passwordField.text;
  NSString *deviceName = [self.deviceNameField.text gh_strip];

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
    [self setError:KBErrorAlert(@"You need to enter a passphrase.")];
    return;
  }

  if ([NSString gh_isBlank:deviceName]) {
    [self setError:KBErrorAlert(@"You need to enter a passphrase.")];
    return;
  }

  if (passphrase.length < 12) {
    [self setError:KBErrorAlert(@"Your passphrase needs to be at least 12 characters long.")];
    return;
  }

  if (![self passwordConfirmed]) {
    [self setError:KBErrorAlert(@"Your passphrases don't match.")];
    return;
  }

  [self setInProgress:YES sender:nil];

  [signup signupWithEmail:email inviteCode:self.inviteField.text passphrase:passphrase username:username deviceName:deviceName completion:^(NSError *error, KBRSignupRes *res) {
    [self setInProgress:NO sender:nil];
    if (error) {
      [self setError:error];
      return;
    }

    self.passwordField.text = nil;

    KBRConfigRequest *config = [[KBRConfigRequest alloc] initWithClient:AppDelegate.client];
    [config getCurrentStatus:^(NSError *error, KBRGetCurrentStatusRes *status) {
      if (error) {
        [self setError:error];
        return;
      }
      [self.delegate signupView:self didSignupWithStatus:status];
    }];
  }];
}

@end
