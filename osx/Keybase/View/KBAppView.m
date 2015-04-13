//
//  KBAppView.m
//  Keybase
//
//  Created by Gabriel on 2/4/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBAppView.h"

#import "KBUsersAppView.h"
#import "KBUserProfileView.h"
#import "AppDelegate.h"
#import "KBLoginView.h"
#import "KBSignupView.h"
#import "KBInstaller.h"
#import "KBDevicesAppView.h"
#import "KBConnectView.h"
#import "KBFoldersAppView.h"

typedef NS_ENUM (NSInteger, KBAppViewStatus) {
  KBAppViewStatusConnecting = 1,
  KBAppViewStatusLogin,
  KBAppViewStatusSignup,
  KBAppViewStatusMain
};

@interface KBAppView ()
@property KBSourceOutlineView *sourceView;
@property (readonly) YOView *contentView;

@property KBUsersAppView *usersAppView;
@property KBDevicesAppView *devicesAppView;
@property KBFoldersAppView *foldersAppView;

@property KBUserProfileView *userProfileView;
@property (nonatomic) KBLoginView *loginView;
@property (nonatomic) KBSignupView *signupView;

@property KBNavigationTitleView *titleView;

@property NSString *title;
@property (nonatomic) KBRGetCurrentStatusRes *status;
@property (nonatomic) KBRConfig *config;
@property KBAppViewStatus appViewStatus;
@end

#define TITLE_HEIGHT (32)

@implementation KBAppView

- (void)viewInit {
  [super viewInit];

  _title = @"Keybase";

  _delegates = [NSHashTable weakObjectsHashTable];

  _sourceView = [[KBSourceOutlineView alloc] init];
  _sourceView.hidden = YES;
  _sourceView.delegate = self;
  [self addSubview:_sourceView];

  KBBox *border = [KBBox line];
  [self addSubview:border];

  _titleView = [KBNavigationTitleView titleViewWithTitle:@"Keybase" navigation:nil];
  [self addSubview:_titleView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat col1 = 160;

    CGFloat x = 0;
    CGFloat y = 0;

    if (!yself.titleView.hidden) {
      y += [layout setFrame:CGRectMake(0, 0, size.width, TITLE_HEIGHT) view:yself.titleView].size.height;
    }

    [layout setFrame:CGRectMake(x, y, col1 - 1, size.height - y) view:yself.sourceView]; // NSOutlieView has trouble initializing to a bad size
    if (!yself.sourceView.hidden) {
      x += col1;
    }

    [layout setFrame:CGRectMake(x - 1, y, 1, size.height - y) view:border];

    [layout setFrame:CGRectMake(x, y, size.width - x, size.height - y) view:yself.contentView];
    return size;
  }];

  [self showConnect];
}

- (void)connect:(KBRPClient *)client {
  _client = client;
  _client.delegate = self;

  for (id<KBAppViewDelegate> delegate in _delegates) [delegate appViewDidLaunch:self];

  GHWeakSelf gself = self;
  [_client registerMethod:@"keybase.1.secretUi.getSecret" sessionId:0 requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    DDLogDebug(@"Password prompt: %@", params);
    KBRGetSecretRequestParams *requestParams = [[KBRGetSecretRequestParams alloc] initWithParams:params];
    [KBAlert promptForInputWithTitle:requestParams.pinentry.prompt description:requestParams.pinentry.desc secure:YES style:NSCriticalAlertStyle buttonTitles:@[@"OK", @"Cancel"] view:self completion:^(NSModalResponse response, NSString *password) {
      KBRSecretEntryRes *entry = [[KBRSecretEntryRes alloc] init];
      entry.text = response == NSAlertFirstButtonReturn ? password : nil;
      entry.canceled = response == NSAlertSecondButtonReturn;
      completion(nil, entry);
    }];
  }];

  [_client registerMethod:@"keybase.1.secretUi.getNewPassphrase" sessionId:0 requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRGetNewPassphraseRequestParams *requestParams = [[KBRGetNewPassphraseRequestParams alloc] initWithParams:params];
    [KBAlert promptForInputWithTitle:requestParams.pinentryPrompt description:requestParams.pinentryDesc secure:YES style:NSCriticalAlertStyle buttonTitles:@[@"OK", @"Cancel"] view:self completion:^(NSModalResponse response, NSString *password) {
      NSString *text = response == NSAlertFirstButtonReturn ? password : nil;
      completion(nil, text);
    }];
  }];

  [_client registerMethod:@"keybase.1.secretUi.getKeybasePassphrase" sessionId:0 requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    DDLogDebug(@"Password prompt: %@", params);
    KBRGetKeybasePassphraseRequestParams *requestParams = [[KBRGetKeybasePassphraseRequestParams alloc] initWithParams:params];
    [KBAlert promptForInputWithTitle:@"Passphrase" description:NSStringWithFormat(@"What's your passphrase (for user %@)?", requestParams.username) secure:YES style:NSCriticalAlertStyle buttonTitles:@[@"OK", @"Cancel"] view:self completion:^(NSModalResponse response, NSString *password) {
      NSString *text = response == NSAlertFirstButtonReturn ? password : nil;
      completion(nil, text);
    }];
  }];

  [_client registerMethod:@"keybase.1.logUi.log" sessionId:0 requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRLogRequestParams *requestParams = [[KBRLogRequestParams alloc] initWithParams:params];
    for (id<KBAppViewDelegate> delegate in gself.delegates) [delegate appView:self didLogMessage:requestParams.text.data];
    completion(nil, nil);
  }];

  [_client checkInstall:^(NSError *error, BOOL installed, KBInstallType installType) {
    if (error) {
      for (id<KBAppViewDelegate> delegate in gself.delegates) [delegate appView:self didErrorOnInstall:error];
      // TODO: We're continuing on in case it's recoverable. We should do something better though.
      [AppDelegate setError:error sender:self];
      // return;
    } else {
      for (id<KBAppViewDelegate> delegate in gself.delegates) [delegate appView:self didCheckInstall:installed installType:installType];
    }

    [gself.client open];
  }];
}

// If we errored while checking status
- (void)setStatusError:(NSError *)error {
  GHWeakSelf gself = self;

  if (gself.appViewStatus == KBAppViewStatusConnecting) {
    NSMutableDictionary *errorInfo = [error.userInfo mutableCopy];
    errorInfo[NSLocalizedRecoveryOptionsErrorKey] = @[@"Retry", @"Quit"];
    error = [NSError errorWithDomain:error.domain code:error.code userInfo:errorInfo];

    [AppDelegate setError:error sender:self completion:^(NSModalResponse res) {
      // Option to retry or quit if we are trying to get status for the first time
      if (res == NSAlertFirstButtonReturn) {
        [self checkStatus:nil];
      } else {
        [AppDelegate.sharedDelegate quitWithPrompt:YES sender:self];
      }
    }];
  } else {
    [AppDelegate setError:error sender:self];
  }
}

- (void)setContentView:(YOView *)contentView showSourceView:(BOOL)showSourceView appViewStatus:(KBAppViewStatus)appViewStatus {
  _appViewStatus = appViewStatus;
  self.sourceView.hidden = !showSourceView;
  self.titleView.hidden = !showSourceView;
  [_contentView removeFromSuperview];
  _contentView = contentView;
  if (_contentView) [self addSubview:_contentView];
  if ([_contentView respondsToSelector:@selector(viewDidAppear:)]) [(id)_contentView viewDidAppear:NO];
  [self setNeedsLayout];
}

- (void)setProgressEnabled:(BOOL)progressEnabled {
  [_titleView setProgressEnabled:progressEnabled];
}

- (BOOL)isProgressEnabled {
  return _titleView.isProgressEnabled;
}

- (KBLoginView *)loginView {
  GHWeakSelf gself = self;
  if (!_loginView) {
    _loginView = [[KBLoginView alloc] init];
    _loginView.delegate = self;
    _loginView.signupButton.targetBlock = ^{
      [gself showSignup];
    };
  }

  // TODO reset progress?
  //[_loginView.navigation setProgressEnabled:NO];
  _loginView.client = _client;
  return _loginView;
}

- (KBSignupView *)signupView {
  GHWeakSelf gself = self;
  if (!_signupView) {
    _signupView = [[KBSignupView alloc] init];
    _signupView.delegate = self;
    _signupView.loginButton.targetBlock = ^{
      [gself showLogin];
    };
  }
  _signupView.client = _client;
  return _signupView;
}

- (void)showConnect {
  KBConnectView *connectView = [[KBConnectView alloc] init];
  connectView.progressView.animating = YES;
  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:connectView title:_title];
  [self setContentView:navigation showSourceView:NO appViewStatus:KBAppViewStatusConnecting];
}

- (void)showLogin {
  KBLoginView *view = [self loginView];
  [view removeFromSuperview];
  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:view title:_title];
  [self setContentView:navigation showSourceView:NO appViewStatus:KBAppViewStatusLogin];
}

- (void)showSignup {
  KBSignupView *view = [self signupView];
  [view removeFromSuperview];
  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:view title:_title];
  [self setContentView:navigation showSourceView:NO appViewStatus:KBAppViewStatusSignup];
}

- (void)showUsers {
  if (!_usersAppView) _usersAppView = [[KBUsersAppView alloc] init];
  _usersAppView.client = _client;
  [self setContentView:_usersAppView showSourceView:YES appViewStatus:KBAppViewStatusMain];
}

- (void)showProfile {
  NSAssert(_user, @"No user");
  if (!_userProfileView) _userProfileView = [[KBUserProfileView alloc] init];
  [_userProfileView setUsername:_user.username client:_client];
  [self setContentView:_userProfileView showSourceView:YES appViewStatus:KBAppViewStatusMain];
  [_sourceView selectItem:KBSourceViewItemProfile];
}

- (void)showDevices {
  if (!_devicesAppView) _devicesAppView = [[KBDevicesAppView alloc] init];
  _devicesAppView.client = _client;
  [_devicesAppView reload];
  [self setContentView:_devicesAppView showSourceView:YES appViewStatus:KBAppViewStatusMain];
}

- (void)showFolders {
  if (!_foldersAppView) _foldersAppView = [[KBFoldersAppView alloc] init];
  _foldersAppView.client = _client;
  [_foldersAppView reload];
  [self setContentView:_foldersAppView showSourceView:YES appViewStatus:KBAppViewStatusMain];
}

- (void)logout:(BOOL)prompt {
  GHWeakSelf gself = self;
  dispatch_block_t logout = ^{
    [self setProgressEnabled:YES];
    KBRLoginRequest *login = [[KBRLoginRequest alloc] initWithClient:gself.client];
    [login logout:^(NSError *error) {
      [self setProgressEnabled:NO];
      if (error) {
        [AppDelegate setError:error sender:self];
        return;
      }

      [self checkStatus:nil];
    }];
  };

  if (prompt) {
    [KBAlert yesNoWithTitle:@"Log Out" description:@"Are you sure you want to log out?" yes:@"Log Out" view:self completion:^(BOOL yes) {
      if (yes) logout();
    }];
  } else {
    logout();
  }
}

- (void)checkStatus:(KBCompletionBlock)completion {
  if (!completion) completion = ^(NSError *error) {
    if (error) [self setStatusError:error];
  };

  GHWeakSelf gself = self;
  KBRConfigRequest *config = [[KBRConfigRequest alloc] initWithClient:_client];
  [config getCurrentStatus:^(NSError *error, KBRGetCurrentStatusRes *status) {
    if (error) {
      completion(error);
      return;
    }
    KBRConfigRequest *request = [[KBRConfigRequest alloc] initWithClient:self.client];
    [request getConfig:^(NSError *error, KBRConfig *config) {
      if (error) {
        if (completion) completion(error);
        return;
      }
      for (id<KBAppViewDelegate> delegate in gself.delegates) [delegate appView:self didCheckStatusWithConfig:config status:status];

      [self setConfig:config];
      [self setStatus:status];
      // TODO reload current view if coming back from disconnect?
      if (completion) completion(nil);
      [NSNotificationCenter.defaultCenter postNotificationName:KBStatusDidChangeNotification object:nil userInfo:@{@"config": config, @"status": status}];
    }];
  }];
}

- (void)setConfig:(KBRConfig *)config {
  _config = config;
  NSString *host = _config.serverURI;
  // TODO Directly accessing API client should eventually go away (everything goes to daemon)
  if ([host isEqualTo:@"https://api.keybase.io:443"]) host = @"https://keybase.io";
  AppDelegate.sharedDelegate.APIClient = [[KBAPIClient alloc] initWithAPIHost:host];
}

- (NSString *)APIURLString:(NSString *)path {
  NSString *host = _config.serverURI;
  if ([host isEqualTo:@"https://api.keybase.io:443"]) host = @"https://keybase.io";
  return [NSString stringWithFormat:@"%@/%@", host, path];
}

- (void)setStatus:(KBRGetCurrentStatusRes *)status {
  _status = status;
  self.user = status.user;

  [self.sourceView.statusView setStatus:status];

  if (_status.loggedIn && _status.user) {
    if (_sourceView.hidden) {
      [self showProfile];
    }
  } else {
    [self showLogin];
  }

  for (id<KBAppViewDelegate> delegate in _delegates) [delegate appViewDidUpdateStatus:self];
}

- (void)setUser:(KBRUser *)user {
  _user = user;
  [self.loginView setUser:user];
}

- (void)signupView:(KBSignupView *)signupView didSignupWithStatus:(KBRGetCurrentStatusRes *)status {
  self.status = status;
}

- (void)loginView:(KBLoginView *)loginView didLoginWithStatus:(KBRGetCurrentStatusRes *)status {
  self.status = status;
}

- (void)RPClientWillConnect:(KBRPClient *)RPClient {
  for (id<KBAppViewDelegate> delegate in _delegates) [delegate appView:self willConnectWithClient:_client];
}

- (void)RPClientDidConnect:(KBRPClient *)RPClient {
  [self.sourceView.statusView setConnected:YES];
  for (id<KBAppViewDelegate> delegate in _delegates) [delegate appView:self didConnectWithClient:_client];
  [self checkStatus:nil];
}

- (void)RPClientDidDisconnect:(KBRPClient *)RPClient {
  [self.sourceView.statusView setConnected:NO];
  for (id<KBAppViewDelegate> delegate in _delegates) [delegate appView:self didDisconnectWithClient:_client];
  [NSNotificationCenter.defaultCenter postNotificationName:KBStatusDidChangeNotification object:nil userInfo:@{}];
}

- (void)RPClient:(KBRPClient *)RPClient didErrorOnConnect:(NSError *)error connectAttempt:(NSInteger)connectAttempt {
  //if (connectAttempt == 1) [AppDelegate.sharedDelegate setFatalError:error]; // Show error on first error attempt
  [self.sourceView.statusView setConnected:NO];
  for (id<KBAppViewDelegate> delegate in _delegates) [delegate appView:self didErrorOnConnect:error connectAttempt:connectAttempt];
  [NSNotificationCenter.defaultCenter postNotificationName:KBStatusDidChangeNotification object:nil userInfo:@{}];
}

- (void)sourceOutlineView:(KBSourceOutlineView *)sourceView didSelectItem:(KBSourceViewItem)item {
  switch (item) {
  case KBSourceViewItemDevices:
    [self showDevices];
    break;
  case KBSourceViewItemFolders:
    [self showFolders];
    break;
  case KBSourceViewItemProfile:
    [self showProfile];
    break;
  case KBSourceViewItemUsers:
    [self showUsers];
    break;
  }
}

- (KBWindow *)createWindow {
  NSAssert(!self.superview, @"Already has superview");
  KBWindow *window = [KBWindow windowWithContentView:self size:CGSizeMake(800, 600) retain:YES];
  window.minSize = CGSizeMake(600, 600);
  //window.restorable = YES;
  window.delegate = self;
  //window.maxSize = CGSizeMake(600, 900);
  window.titleVisibility = NO;
  window.styleMask = NSClosableWindowMask | NSFullSizeContentViewWindowMask | NSTitledWindowMask | NSResizableWindowMask | NSMiniaturizableWindowMask;

  window.backgroundColor = KBAppearance.currentAppearance.secondaryBackgroundColor;
  window.restorable = YES;
  //window.restorationClass = self.class;
  //window.navigation.titleView = [KBTitleView titleViewWithTitle:@"Keybase" navigation:window.navigation];
  //[window setLevel:NSStatusWindowLevel];
  return window;
}

- (KBWindow *)openWindow {
  NSAssert(!self.window, @"Already has window");
  KBWindow *window = [self createWindow];
  [window center];
  [window makeKeyAndOrderFront:nil];
  window.delegate = self;
  return window;
}

- (NSRect)window:(NSWindow *)window willPositionSheet:(NSWindow *)sheet usingRect:(NSRect)rect {
  rect.origin.y += -TITLE_HEIGHT;
  return rect;
}

//- (void)encodeRestorableStateWithCoder:(NSCoder *)coder { }
//- (void)restoreStateWithCoder:(NSCoder *)coder { }
//invalidateRestorableState

//+ (void)restoreWindowWithIdentifier:(NSString *)identifier state:(NSCoder *)state completionHandler:(void (^)(NSWindow *window, NSError *error))completionHandler {
//  KBAppView *appView = [[KBAppView alloc] init];
//  NSWindow *window = [appView createWindow];
//  completionHandler(window, nil);
//}

@end
