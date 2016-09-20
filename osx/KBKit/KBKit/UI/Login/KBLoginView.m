//
//  KBLoginView.m
//  Keybase
//
//  Created by Gabriel on 2/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBLoginView.h"
#import "KBDeviceSetupChooseView.h"
#import "KBDeviceSetupPromptView.h"
#import "KBDeviceSetupDisplayView.h"
#import "KBPaperKeyDisplayView.h"
#import "KBDefines.h"

#import <YOLayout/YOLayout+PrefabLayouts.h>

#define PASSWORD_PLACEHOLDER (@"-----------")

@interface KBLoginView () <NSTextFieldDelegate, KBTextFieldFocusDelegate>
@property KBSecureTextField *passwordField;
@property KBButton *saveToKeychainButton;
@property KBRLoginRequest *request;
@property (nonatomic) NSString *username;
@property NSArray *accounts;

@property KBDeviceSetupChooseView *deviceSetupView;
@end

@implementation KBLoginView

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

  KBLabel *label = [[KBLabel alloc] init];
  [label setMarkup:@"<p><thin>Welcome to</thin> Keybase</p>" style:KBTextStyleHeader alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  [contentView addSubview:label];

  _usernameField = [[KBTextField alloc] init];
  _usernameField.focusDelegate = self;
  _usernameField.placeholder = @"Email or Username";
  [contentView addSubview:_usernameField];

  _passwordField = [[KBSecureTextField alloc] init];
  _passwordField.placeholder = @"Passphrase";
  [contentView addSubview:_passwordField];

  _saveToKeychainButton = [KBButton buttonWithText:@"Remember Me" style:KBButtonStyleCheckbox];
  _saveToKeychainButton.dispatchBlock = ^(KBButton *button, dispatch_block_t completion) {
    [gself keychainChanged:button.state == NSOnState];
    completion();
  };
  [contentView addSubview:_saveToKeychainButton];

  _loginButton = [KBButton buttonWithText:@"Log In" style:KBButtonStylePrimary];
  _loginButton.targetBlock = ^{
    [gself login];
  };
  [_loginButton setKeyEquivalent:@"\r"];
  [contentView addSubview:_loginButton];

  _signupButton = [KBButton buttonWithText:@"Don't have an account? Sign Up" style:KBButtonStyleLink];
  [contentView addSubview:_signupButton];

//  KBButton *forgotPasswordButton = [KBButton buttonWithText:@"Forgot my password" style:KBButtonStyleLink];
//  [self addSubview:forgotPasswordButton];

  YOSelf yself = self;
  contentView.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 50;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:label].size.height + 40;

    y += [layout centerWithSize:CGSizeMake(300, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.usernameField].size.height + 12;
    y += [layout centerWithSize:CGSizeMake(300, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.passwordField].size.height + 12;

    y += 6;
    y += [layout sizeToFitInFrame:CGRectMake(56, y, size.width - 80, 0) view:yself.saveToKeychainButton].size.height + 12;

    y += 30;

    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.loginButton].size.height + 30;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width, 0) view:yself.signupButton].size.height + 20;

//    y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width, 0) view:forgotPasswordButton].size.height + 20;

    y += 20;

    return CGSizeMake(MIN(380, size.width), y);
  }];

  self.viewLayout = [YOLayout center:contentView];
}

- (void)viewDidAppear:(BOOL)animated {
  [self.window recalculateKeyViewLoop];
  if ([_usernameField.text gh_present]) {
    [self.window makeFirstResponder:_passwordField];
  } else {
    [self.window makeFirstResponder:_usernameField];
  }
}

- (void)setUsername:(NSString *)username {
  _username = username;
  if ([_username gh_present]) {
    self.usernameField.text = _username;
    //self.usernameField.textField.editable = NO;
  }
  [self loadAccounts];
}

- (void)login {
  NSString *username = self.usernameField.text;
  NSString *passphrase = self.passwordField.text;

  NSAssert(self.navigation, @"No navigation");

  if ([NSString gh_isBlank:username]) {
    [KBActivity setError:KBErrorAlert(@"You need to enter a username or email address.") sender:_usernameField];
    return;
  }

  if ([NSString gh_isBlank:passphrase]) {
    [KBActivity setError:KBErrorAlert(@"You need to enter a password.") sender:_passwordField];
    return;
  }

  // TODO
}

- (void)_didLogin:(NSString *)username {
  self.passwordField.text = @""; // Clear password field after login

  if (_saveToKeychainButton.state != NSOnState) {
    [self clearKeychain:username completion:^(NSError *error) {
      [self loadAccounts];
    }];
  }

  [self.navigation.titleView setProgressEnabled:YES];

  [self.delegate loginViewDidLogin:self];
}

- (void)textField:(KBTextField *)textField didChangeFocus:(BOOL)focused {
  [self updateForAccounts];
}

- (void)loadAccounts {
  KBRLoginRequest *request = [[KBRLoginRequest alloc] initWithClient:self.client];
  GHWeakSelf gself = self;
  [request getConfiguredAccounts:^(NSError *error, NSArray *accounts) {
    gself.accounts = accounts;
    [self updateForAccounts];
  }];
}

- (void)updateForAccounts {
  NSString *username = self.usernameField.text;
  KBRConfiguredAccount *account = [_accounts detect:^(KBRConfiguredAccount *account) { return [account.username isEqualToString:username]; }];
  if (!account.hasStoredSecret) {
    self.saveToKeychainButton.state = NSOffState;
    if ([self.passwordField.text isEqualToString:PASSWORD_PLACEHOLDER]) self.passwordField.text = @"";
  } else {
    self.saveToKeychainButton.state = NSOnState;
    self.passwordField.text = PASSWORD_PLACEHOLDER; // 11 character placehold (since passwords must be 12); TODO: Don't use magic value
  }
}

- (void)keychainChanged:(BOOL)enabled {
  NSString *username = self.usernameField.text;
  NSString *passphrase = self.passwordField.text;
  KBRConfiguredAccount *account = [_accounts detect:^(KBRConfiguredAccount *account) { return [account.username isEqualToString:username]; }];

  if (!enabled && [passphrase isEqualToString:PASSWORD_PLACEHOLDER]) {
    self.passwordField.text = @"";
  } else if (enabled && account.hasStoredSecret && [NSString gh_isBlank:passphrase]) {
    self.passwordField.text = PASSWORD_PLACEHOLDER;
  }
}

- (void)clearKeychain:(NSString *)username completion:(MPCompletion)completion {
  DDLogDebug(@"Clearing cached secret for %@", username);
  KBRLoginRequest *request = [[KBRLoginRequest alloc] initWithClient:self.client];
  [request clearStoredSecretWithUsername:username completion:completion];
}

- (void)handleError:(NSError *)error {
  if (KBIsErrorName(error, @"BAD_LOGIN_USER_NOT_FOUND")) {
    [self.window makeFirstResponder:self.usernameField];
    error = KBMakeErrorWithRecovery(error.code, @"Wrong Username", @"The username you entered doesn't exist.");
  } else if (KBIsErrorName(error, @"BAD_LOGIN_PASSWORD")) {
    [self.window makeFirstResponder:self.passwordField];
    error = KBMakeErrorWithRecovery(error.code, @"Bad Password", @"The username and password you entered was invalid.");

    if ([self.passwordField.text isEqualToString:PASSWORD_PLACEHOLDER]) {
      self.passwordField.text = @"";
    }
  } else if (KBIsErrorName(error, @"ALREADY_LOGGED_IN")) {
    // Workaround bug where the service reports not logged in, but when we try to login, it says already logged in.
    // Remove when fixed (or keep as a failsafe).
    // https://github.com/keybase/client/issues/595
    KBRLoginRequest *request = [[KBRLoginRequest alloc] initWithClient:self.client];
    [request logout:^(NSError *error) {
      if (error) {
        [KBActivity setError:error sender:self];
      } else {
        [KBActivity setError:KBErrorAlert(@"There was a login in progress and we had to manually logout. Please try logging in again.") sender:self];
      }
    }];
    return;
  }

  [KBActivity setError:error sender:self];
}

- (void)goBackToLogin {
  [self.navigation popToRootViewAnimated:YES];
}

@end

