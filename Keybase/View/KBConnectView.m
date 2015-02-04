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
@property KBTextField *passwordField;
@property KBButton *loginButton;
@property KBButton *signupButton;
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

- (void)viewWillAppearInView:(NSView *)view animated:(BOOL)animated {
  [super viewWillAppearInView:view animated:animated];
  if (view.subviews.count == 0) [self setView:_loginView transitionType:KBNavigationTransitionTypeNone];
}

- (void)layout {
  [super layout];
  _loginView.frame = self.bounds;
  _signupView.frame = self.bounds;
}

- (void)showLogin:(BOOL)animated {
  [self swapView:_loginView animated:animated];
}

- (void)showSignup:(BOOL)animated {
  [self swapView:_signupView animated:animated];
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

  _signupButton = [KBButton buttonWithText:@"Sign Up" style:KBButtonStyleLink];
  _signupButton.alignment = NSLeftTextAlignment;
  [self addSubview:_signupButton];

  _usernameField.nextKeyView = _passwordField;
  _passwordField.nextKeyView = _loginButton;
  _loginButton.nextKeyView = _usernameField;

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 60;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.usernameField].size.height + 10;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.passwordField].size.height + 40;

    CGRect buttonFrame = [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.loginButton];
    y += buttonFrame.size.height + 10;
    y += [layout setFrame:CGRectMake(buttonFrame.origin.x, y, 0, 30) view:yself.signupButton options:YOLayoutOptionsSizeToFitHorizontal].size.height;

    return CGSizeMake(size.width, y);
  }];
}

- (void)viewDidAppear:(BOOL)animated {
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

@interface KBSignupView ()
@property KBLabel *usernameStatusLabel;
@property KBStrengthLabel *strengthLabel;
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

  _passwordField = [[KBSecureTextField alloc] init];
  _passwordField.placeholder = @"Passphrase";
  _passwordField.textField.delegate = self;
  [self addSubview:_passwordField];

  _strengthLabel = [[KBStrengthLabel alloc] init];
  [self addSubview:_strengthLabel];

  _usernameStatusLabel = [[KBLabel alloc] init];
  [self addSubview:_usernameStatusLabel];

  _signupButton = [KBButton buttonWithText:@"Sign Up" style:KBButtonStylePrimary];
  _signupButton.targetBlock = ^{
    [gself signup];
  };
  [self addSubview:_signupButton];

  _loginButton = [KBButton buttonWithText:@"Log In" style:KBButtonStyleLink];
  _loginButton.alignment = NSLeftTextAlignment;
  [self addSubview:_loginButton];

  _emailField.nextKeyView = _usernameField;
  _usernameField.nextKeyView = _passwordField;
  _passwordField.nextKeyView = _loginButton;
  _loginButton.nextKeyView = _usernameField;

  [AppDelegate.client registerMethod:@"keybase.1.gpgUi.SelectKey" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRSelectKeyRes *response = [[KBRSelectKeyRes alloc] init];
    completion(nil, response);
  }];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 60;

    //y += [layout setFrame:CGRectMake(20, y, size.width - 40, 22) view:yself.inviteField].size.height + 10;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.emailField].size.height + 10;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.usernameField].size.height;
    [layout setFrame:CGRectMake(size.width - 80 - 40, y - 22, 80, 24) view:yself.usernameStatusLabel];
    y += 10;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.passwordField].size.height;
    [layout setFrame:CGRectMake(size.width - 80 - 40, y - 22, 80, 24) view:yself.strengthLabel];
    y += 40;

    CGRect buttonFrame = [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.signupButton];
    y += buttonFrame.size.height + 10;
    y += [layout setFrame:CGRectMake(buttonFrame.origin.x, y, 0, 30) view:yself.loginButton options:YOLayoutOptionsSizeToFitHorizontal].size.height;

    return CGSizeMake(size.width, y);
  }];
}

- (void)viewDidAppear:(BOOL)animated {
  [self.window makeFirstResponder:_emailField];
}

- (void)controlTextDidChange:(NSNotification *)notification {
  NSTextField *textField = [notification object];
  if (textField == _usernameField.textField) _usernameStatusLabel.attributedText = nil;
  else if (textField == _passwordField.textField) [self checkPassword];
}

- (void)controlTextDidEndEditing:(NSNotification *)notification {
  NSTextField *textField = [notification object];
  if (textField == _usernameField.textField) [self checkUsername];
}

- (void)checkPassword {
  NSString *password = [_passwordField.text gh_strip];
  [_strengthLabel setPassword:password];
}

- (void)checkUsername {
  NSString *userName = [_usernameField.text gh_strip];

  GHWeakSelf gself = self;
  [AppDelegate.APIClient checkForUserName:userName success:^(BOOL exists) {
    if (!exists) {
      [gself.usernameStatusLabel setText:@"OK" font:[NSFont systemFontOfSize:12] color:[KBLookAndFeel okColor] alignment:NSRightTextAlignment];
    } else {
      [gself.usernameStatusLabel setText:@"Already taken" font:[NSFont systemFontOfSize:12] color:[KBLookAndFeel errorColor] alignment:NSRightTextAlignment];
    }
  } failure:^(NSError *error) {
    GHErr(@"Error: %@", error);
    gself.usernameStatusLabel.attributedText = nil;
  }];
}

- (void)signup {
  KBRSignupRequest *signup = [[KBRSignupRequest alloc] initWithClient:AppDelegate.client];

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
    [self setError:KBErrorAlert(@"You need to enter a passphrase.")];
    return;
  }

  if (passphrase.length < 12) {
    [self setError:KBErrorAlert(@"Your passphrase needs to be at least 12 characters long.")];
    return;
  }

  [self setInProgress:YES sender:nil];

  [signup signupWithEmail:email inviteCode:self.inviteField.text passphrase:passphrase username:username deviceName:@"" completion:^(NSError *error, KBRSignupRes *res) {
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
