//
//  KBLoginView.m
//  Keybase
//
//  Created by Gabriel on 2/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBLoginView.h"
#import "AppDelegate.h"

@interface KBLoginView ()
@property KBSecureTextField *passwordField;
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

  [AppDelegate.client registerMethod:@"keybase.1.doctorUi.selectSigner" owner:self requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    //    KBRSelectSignerRequestHandler *handler = [[KBRSelectSignerRequestHandler alloc] initWithParams:params];
    //    KBRSelectSignerRes *response = [[KBRSelectSignerRes alloc] init];
    //    response.action = KBRSelectSignerActionSign;
    //    response.signer =
    //    completion(nil, response);

    // TODO
    completion(KBMakeError(-1, @"Unsupported", @"Can't login from a different device yet."), nil);
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

    KBRConfigRequest *config = [[KBRConfigRequest alloc] initWithClient:AppDelegate.client];
    [config getCurrentStatus:^(NSError *error, KBRGetCurrentStatusRes *status) {
      if (error) {
        [AppDelegate setError:error sender:self];
        return;
      }
      [self.delegate loginView:self didLoginWithStatus:status];
    }];
  }];
}

@end

