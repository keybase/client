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
#import "KBDefines.h"

#define PASSWORD_PLACEHOLDER (@"-----------")

@interface KBLoginView () <KBTextFieldFocusDelegate>
@property KBSecureTextField *passwordField;
@property KBButton *saveToKeychainButton;
@property KBRLoginRequest *request;
@property (nonatomic) NSString *username;
@property NSArray *accounts;
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
  _saveToKeychainButton.dispatchBlock = ^(KBButton *button, KBButtonCompletion completion) {
    [gself keychainChanged:button.state == NSOnState];
    completion(nil);
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

  NSAssert(self.client, @"No RPC client");
  KBRPClient * client = self.client;
  _request = [[KBRLoginRequest alloc] initWithClient:client];

  [client registerMethod:@"keybase.1.locksmithUi.promptDeviceName" sessionId:_request.sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    //KBRPromptDeviceNameRequestParams *requestParams = [[KBRPromptDeviceNameRequestParams alloc] initWithParams:params];
    [self.navigation setProgressEnabled:NO];
    KBDeviceSetupPromptView *devicePromptView = [[KBDeviceSetupPromptView alloc] init];
    devicePromptView.cancelButton.targetBlock = ^{
      [self cancelLogin];
    };
    devicePromptView.completion = ^(id sender, NSError *error, NSString *deviceName) {
      [self.navigation setProgressEnabled:YES];
      completion(error, deviceName);
    };
    [self.navigation pushView:devicePromptView animated:YES];
  }];

  [client registerMethod:@"keybase.1.locksmithUi.selectSigner" sessionId:_request.sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRSelectSignerRequestParams *requestParams = [[KBRSelectSignerRequestParams alloc] initWithParams:params];
    [self.navigation setProgressEnabled:NO];
    [self selectSigner:requestParams completion:completion];
  }];

  [self.client registerMethod:@"keybase.1.locksmithUi.displaySecretWords" sessionId:_request.sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRDisplaySecretWordsRequestParams *requestParams = [[KBRDisplaySecretWordsRequestParams alloc] initWithParams:params];

    [self.navigation setProgressEnabled:NO];
    KBDeviceSetupDisplayView *deviceSetupDisplayView = [[KBDeviceSetupDisplayView alloc] init];
    [deviceSetupDisplayView setSecretWords:requestParams.secret deviceNameExisting:requestParams.deviceNameExisting deviceNameToAdd:requestParams.deviceNameToAdd];
    deviceSetupDisplayView.button.targetBlock = ^{
      completion(nil, nil);
    };
    deviceSetupDisplayView.cancelButton.targetBlock = ^{
      [self cancelLogin];
    };
    [self.navigation pushView:deviceSetupDisplayView animated:YES];
  }];

  BOOL storeSecret = _saveToKeychainButton.state == NSOnState;

  if ([passphrase isEqualToString:PASSWORD_PLACEHOLDER]) {
    [self.navigation setProgressEnabled:YES];
    [_request loginWithStoredSecretWithSessionID:_request.sessionId username:username completion:^(NSError *error) {
      [self.navigation setProgressEnabled:NO];
      if (error) {
        [self handleError:error];
        return;
      }
      [self _didLogin:username];
    }];
  } else {
    [self.navigation setProgressEnabled:YES];
    [_request loginWithPassphraseWithSessionID:_request.sessionId username:username passphrase:passphrase storeSecret:storeSecret completion:^(NSError *error) {
      [self.navigation setProgressEnabled:NO];
      if (error) {
        [self handleError:error];
        return;
      }
      [self _didLogin:username];
    }];
  }
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
  [request getConfiguredAccountsWithSessionID:request.sessionId completion:^(NSError *error, NSArray *accounts) {
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
  [request clearStoredSecretWithSessionID:request.sessionId username:username completion:completion];
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
  }

  [KBActivity setError:error sender:self];
}

- (void)goBackToLogin {
  [self.navigation popToRootViewAnimated:YES];
}

- (void)cancelLogin {
  KBRLoginRequest *request = [[KBRLoginRequest alloc] initWithClient:self.client];
  [request cancelLoginWithSessionID:request.sessionId completion:^(NSError *error) {
    [KBActivity setError:error sender:self];
    [self goBackToLogin];
  }];
}

- (void)selectSigner:(KBRSelectSignerRequestParams *)params completion:(MPRequestCompletion)completion {
  KBDeviceSetupChooseView *deviceSetupView = [[KBDeviceSetupChooseView alloc] init];
  [deviceSetupView setDevices:params.devices hasPGP:params.hasPGP];

  __weak KBDeviceSetupChooseView *gdeviceSetupView = deviceSetupView;
  deviceSetupView.selectButton.targetBlock = ^{
    KBDeviceSignerOption *option = [gdeviceSetupView.deviceSignerView selectedObject];
    if (!option) {
      [KBActivity setError:KBMakeError(-1, @"You need to select an option or cancel.") sender:self];
      return;
    }

    KBRSelectSignerRes *response = [[KBRSelectSignerRes alloc] init];
    response.action = KBRSelectSignerActionSign;
    KBRDeviceSigner *signer = [[KBRDeviceSigner alloc] init];
    switch (option.signerType) {
      case KBDeviceSignerTypePGP: {
        signer.kind = KBRDeviceSignerKindPgp;
        break;
      }
      case KBDeviceSignerTypeDevice: {
        signer.kind = KBRDeviceSignerKindDevice;
        signer.deviceID = option.device.deviceID;
        signer.deviceName = option.device.name;
        break;
      }
    }
    response.signer = signer;
    [self.navigation setProgressEnabled:YES];
    completion(nil, response);
  };

  deviceSetupView.cancelButton.targetBlock = ^{
    [self cancelLogin];
    /*
    KBRSelectSignerRes *response = [[KBRSelectSignerRes alloc] init];
    response.action = KBRSelectSignerActionCancel;
    completion(nil, response);
     */
  };

  [self.navigation pushView:deviceSetupView animated:YES];
}

@end

