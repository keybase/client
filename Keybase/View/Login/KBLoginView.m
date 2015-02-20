//
//  KBLoginView.m
//  Keybase
//
//  Created by Gabriel on 2/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBLoginView.h"
#import "AppDelegate.h"
#import "KBDeviceSetupView.h"

@interface KBLoginView ()
@property KBSecureTextField *passwordField;
@end

@implementation KBLoginView

- (void)viewInit {
  [super viewInit];
  GHWeakSelf gself = self;

  KBLabel *label = [[KBLabel alloc] init];
  [label setMarkup:@"<p>Welcome to Keybase.</p>" font:[NSFont systemFontOfSize:20] color:[KBLookAndFeel textColor] alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  [self addSubview:label];

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

//  KBButton *forgotPasswordButton = [KBButton buttonWithText:@"Forgot my password" style:KBButtonStyleLink];
//  [self addSubview:forgotPasswordButton];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 30;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:label].size.height + 40;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.usernameField].size.height + 12;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.passwordField].size.height + 12;

    y += 30;

    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.loginButton].size.height + 30;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width, 0) view:yself.signupButton].size.height + 20;

//    y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width, 0) view:forgotPasswordButton].size.height + 20;

    y += 20;

    return CGSizeMake(size.width, y);
  }];
}

- (void)viewDidAppear:(BOOL)animated {
  [self.window recalculateKeyViewLoop];
  [self.window makeFirstResponder:_usernameField];
}

- (void)_checkStatusAfterLogin {
  KBRConfigRequest *config = [[KBRConfigRequest alloc] initWithClient:AppDelegate.client];
  [self.navigation.titleView setProgressEnabled:YES];
  [config getCurrentStatus:^(NSError *error, KBRGetCurrentStatusRes *status) {
    [self.navigation.titleView setProgressEnabled:NO];
    if (error) {
      [AppDelegate setError:error sender:self];
      return;
    }
    [self.delegate loginView:self didLoginWithStatus:status];
  }];
}

//- (void)loginWithKey {
//  KBRLoginRequest *login = [[KBRLoginRequest alloc] initWithClient:AppDelegate.client];
//  [login pubkeyLogin:^(NSError *error) {
//    [self _checkStatusAfterLogin];
//  }];
//}

- (void)login {
  NSString *username = self.usernameField.text;
  NSString *passphrase = self.passwordField.text;

  if ([NSString gh_isBlank:username]) {
    [AppDelegate setError:KBErrorAlert(@"You need to enter a username or email address.") sender:_usernameField];
    return;
  }

  if ([NSString gh_isBlank:passphrase]) {
    [AppDelegate setError:KBErrorAlert(@"You need to enter a password.") sender:_passwordField];
    return;
  }

  KBRLoginRequest *login = [[KBRLoginRequest alloc] initWithClient:AppDelegate.client];

  // TODO
//  [AppDelegate.client registerMethod:@"keybase.1.doctorUi.promptDeviceName" owner:self requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
//    //KBRPromptDeviceNameRequestParams *handler = [[KBRPromptDeviceNameRequestParams alloc] initWithParams:params];
//    //completion(nil, @"");
//  }];

  [AppDelegate.client registerMethod:@"keybase.1.doctorUi.selectSigner" owner:self requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRSelectSignerRequestParams *handler = [[KBRSelectSignerRequestParams alloc] initWithParams:params];
    [self selectSigner:handler completion:completion];
  }];

  [AppDelegate setInProgress:YES view:self];
  [self.navigation.titleView setProgressEnabled:YES];
  [login passphraseLoginWithIdentify:false username:username passphrase:passphrase completion:^(NSError *error) {
    [AppDelegate setInProgress:NO view:self];
    [self.navigation.titleView setProgressEnabled:NO];
    [AppDelegate.client unregister:self];
    if (error) {
      [AppDelegate setError:error sender:self];
      return;
    }

    self.passwordField.text = nil;
    [self _checkStatusAfterLogin];
  }];

  [AppDelegate.APIClient logInWithEmailOrUserName:username password:passphrase success:^(KBSession *session) {
  } failure:^(NSError *error) {
  }];
}

- (void)selectSigner:(KBRSelectSignerRequestParams *)params completion:(MPRequestCompletion)completion {
  KBDeviceSetupView *deviceSetupView = [[KBDeviceSetupView alloc] init];
  [deviceSetupView setDevices:params.devices hasPGP:params.hasPGP];

  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:deviceSetupView];
  NSWindow *selectWindow = [KBWindow windowWithContentView:navigation size:CGSizeMake(500, 400) retain:YES];
  navigation.titleView = [KBTitleView titleViewWithTitle:@"Device Setup" navigation:navigation];

  __weak KBDeviceSetupView *gdeviceSetupView = deviceSetupView;
  deviceSetupView.selectButton.targetBlock = ^{
    KBDeviceSignerOption *option = [gdeviceSetupView.deviceSignerView selectedObject];
    if (!option) {
      [AppDelegate setError:KBMakeError(-1, @"You need to select an option or cancel.", @"") sender:self];
      return;
    }

    [self.window endSheet:selectWindow];

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
        signer.deviceID = option.identifier;
        break;
      }
    }
    response.signer = signer;
    completion(nil, response);
  };

  deviceSetupView.cancelButton.targetBlock = ^{
    [self.window endSheet:selectWindow];
    KBRSelectSignerRes *response = [[KBRSelectSignerRes alloc] init];
    response.action = KBRSelectSignerActionLogout; // Will be renamed to cancel
    completion(nil, response);
  };

  [self.window beginSheet:selectWindow completionHandler:^(NSModalResponse returnCode) {}];
}

@end

