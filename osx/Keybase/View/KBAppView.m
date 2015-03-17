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
#import "KBUserStatusView.h"
#import "KBDevicesAppView.h"
#import "KBConnectView.h"
#import "KBFoldersAppView.h"

@interface KBAppView ()
@property KBSourceOutlineView *sourceView;
@property (readonly) YOView *contentView;

@property KBUsersAppView *usersAppView;
@property KBDevicesAppView *devicesAppView;
@property KBFoldersAppView *foldersAppView;

@property KBUserProfileView *userProfileView;
@property (nonatomic) KBConnectView *connectView;
@property (nonatomic) KBLoginView *loginView;
@property (nonatomic) KBSignupView *signupView;

@property NSString *title;
@property NSStatusItem *statusItem; // Menubar
@property (nonatomic) KBRGetCurrentStatusRes *status;
@end

@implementation KBAppView

- (void)viewInit {
  [super viewInit];

  _title = @"Keybase";

  _statusItem = [[NSStatusBar systemStatusBar] statusItemWithLength:NSVariableStatusItemLength];
  //_statusItem.title = @"Keybase";
  _statusItem.image = [NSImage imageNamed:@"StatusIcon"];
  //_statusItem.alternateImage = [NSImage imageNamed:@""]; // Highlighted
  _statusItem.highlightMode = YES; // Blue background when selected

  [self updateMenu];

  _sourceView = [[KBSourceOutlineView alloc] init];
  _sourceView.hidden = YES;
  _sourceView.delegate = self;
  [self addSubview:_sourceView];

  KBBox *border = [KBBox lineWithWidth:1.0 color:KBAppearance.currentAppearance.lineColor];
  [self addSubview:border];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat col1 = 160;

    CGFloat x = 0;
    CGFloat y = 24;
    [layout setFrame:CGRectMake(x, y, col1 - 1, size.height - y) view:yself.sourceView]; // NSOutlieView has trouble initializing to a bad size
    if (!yself.sourceView.hidden) {
      x += col1;
    }
    y = 0;
    [layout setFrame:CGRectMake(x - 1, y, 1, size.height - y) view:border];

    [layout setFrame:CGRectMake(x, y, size.width - x, size.height - y) view:yself.contentView];
    return size;
  }];

  [self showConnect];
}

- (void)updateMenu {
  NSMenu *menu = [[NSMenu alloc] init];

  [menu addItemWithTitle:@"Preferences" action:@selector(preferences:) keyEquivalent:@""];

  if (_status) {
    if (_status.loggedIn && _status.user) {
      [menu addItemWithTitle:NSStringWithFormat(@"Log Out (%@)", _status.user.username) action:@selector(logout) keyEquivalent:@""];
      [menu addItem:[NSMenuItem separatorItem]];
    } else {
      [menu addItemWithTitle:@"Log In" action:@selector(showLogin) keyEquivalent:@""];
      [menu addItem:[NSMenuItem separatorItem]];
    }
  }

  [menu addItem:[NSMenuItem separatorItem]];
  [menu addItemWithTitle:@"Quit" action:@selector(quit:) keyEquivalent:@""];

  _statusItem.menu = menu;
}

- (void)connect:(KBRPClient *)client {
  _client = client;
  _client.delegate = self;

  [self.delegate appView:self didLaunchWithClient:self.client];

  GHWeakSelf gself = self;
  [_client registerMethod:@"keybase.1.secretUi.getSecret" sessionId:0 requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    GHDebug(@"Password prompt: %@", params);
    KBRGetSecretRequestParams *requestParams = [[KBRGetSecretRequestParams alloc] initWithParams:params];
    [KBAlert promptForInputWithTitle:requestParams.pinentry.prompt description:requestParams.pinentry.desc secure:YES style:NSCriticalAlertStyle buttonTitles:@[@"OK", @"Cancel"] view:nil completion:^(NSModalResponse response, NSString *password) {
      KBRSecretEntryRes *entry = [[KBRSecretEntryRes alloc] init];
      entry.text = response == NSAlertFirstButtonReturn ? password : nil;
      entry.canceled = response == NSAlertSecondButtonReturn;
      completion(nil, entry);
    }];
  }];

  [_client registerMethod:@"keybase.1.secretUi.getNewPassphrase" sessionId:0 requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRGetNewPassphraseRequestParams *requestParams = [[KBRGetNewPassphraseRequestParams alloc] initWithParams:params];
    [KBAlert promptForInputWithTitle:requestParams.pinentryPrompt description:requestParams.pinentryDesc secure:YES style:NSCriticalAlertStyle buttonTitles:@[@"OK", @"Cancel"] view:nil completion:^(NSModalResponse response, NSString *password) {
      NSString *text = response == NSAlertFirstButtonReturn ? password : nil;
      completion(nil, text);
    }];
  }];

  [_client registerMethod:@"keybase.1.secretUi.getKeybasePassphrase" sessionId:0 requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    GHDebug(@"Password prompt: %@", params);
    KBRGetKeybasePassphraseRequestParams *requestParams = [[KBRGetKeybasePassphraseRequestParams alloc] initWithParams:params];
    [KBAlert promptForInputWithTitle:@"Passphrase" description:NSStringWithFormat(@"What's your passphrase (for user %@)?", requestParams.username) secure:YES style:NSCriticalAlertStyle buttonTitles:@[@"OK", @"Cancel"] view:nil completion:^(NSModalResponse response, NSString *password) {
      NSString *text = response == NSAlertFirstButtonReturn ? password : nil;
      completion(nil, text);
    }];
  }];

  [_client registerMethod:@"keybase.1.logUi.log" sessionId:0 requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRLogRequestParams *requestParams = [[KBRLogRequestParams alloc] initWithParams:params];
    [self.delegate appView:self didLogMessage:requestParams.text.data];
    completion(nil, nil);
  }];

  [_client checkInstall:^(NSError *error) {
    [self.delegate appView:self didCheckInstallWithClient:gself.client];
    // TODO Better error handling here
    if (error) {
      [AppDelegate.sharedDelegate setFatalError:error];
      return;
    }

    [gself.client open];
  }];
}

- (void)setContentView:(YOView *)contentView showSourceView:(BOOL)showSourceView {
  self.sourceView.hidden = !showSourceView;
  [_contentView removeFromSuperview];
  _contentView = contentView;
  if (_contentView) [self addSubview:_contentView];
  if ([_contentView respondsToSelector:@selector(viewDidAppear:)]) [(id)_contentView viewDidAppear:NO];
  [self setNeedsLayout];
}

- (void)setProgressEnabled:(BOOL)progressEnabled {
  [_sourceView setProgressEnabled:progressEnabled];
}

- (BOOL)isProgressEnabled {
  return _sourceView.isProgressEnabled;
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

- (KBConnectView *)connectView {
  if (!_connectView) {
    _connectView = [[KBConnectView alloc] init];
  }
  return _connectView;
}

- (void)showConnect {
  KBConnectView *connectView = [self connectView];
  connectView.progressView.animating = YES;
  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:connectView title:_title];
  [self setContentView:navigation showSourceView:NO];
}

- (void)showLogin {
  KBLoginView *view = [self loginView];
  [view removeFromSuperview];
  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:view title:_title];
  [self setContentView:navigation showSourceView:NO];
}

- (void)showSignup {
  KBSignupView *view = [self signupView];
  [view removeFromSuperview];
  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:view title:_title];
  [self setContentView:navigation showSourceView:NO];
}

- (void)showUsers {
  if (!_usersAppView) _usersAppView = [[KBUsersAppView alloc] init];
  _usersAppView.client = _client;
  [self setContentView:_usersAppView showSourceView:YES];
}

- (void)showProfile {
  NSAssert(_user, @"No user");
  _userProfileView = [[KBUserProfileView alloc] init];
  _userProfileView.client = _client;
  [_userProfileView setUser:_user editable:YES client:_client];
  [self setContentView:_userProfileView showSourceView:YES];
  [_sourceView selectItem:KBSourceViewItemProfile];
}

- (void)showDevices {
  if (!_devicesAppView) _devicesAppView = [[KBDevicesAppView alloc] init];
  _devicesAppView.client = _client;
  [_devicesAppView reload];
  [self setContentView:_devicesAppView showSourceView:YES];
}

- (void)showFolders {
  if (!_foldersAppView) _foldersAppView = [[KBFoldersAppView alloc] init];
  _foldersAppView.client = _client;
  [_foldersAppView reload];
  [self setContentView:_foldersAppView showSourceView:YES];
}

- (void)logout {
  GHWeakSelf gself = self;
  [KBAlert yesNoWithTitle:@"Log Out" description:@"Are you sure you want to log out?" yes:@"Log Out" view:self completion:^(BOOL yes) {
    if (yes) {
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
    }
  }];
}

- (void)checkStatus:(KBCompletionBlock)completion {
  GHWeakSelf gself = self;

  if (!completion) completion = ^(NSError *error) { if (error) [AppDelegate.sharedDelegate setFatalError:error]; };

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
      [self setConfig:config];
      [self setStatus:status];
      [self.delegate appView:self didCheckStatusWithClient:gself.client config:config status:status];
      // TODO reload current view if coming back from disconnect?
      if (completion) completion(nil);
    }];
  }];
}

- (void)setConfig:(KBRConfig *)config {
  NSString *host = config.serverURI;
  // TODO API client should eventually go away (everything goes to daemon)
  if ([host isEqualTo:@"https://api.keybase.io:443"]) host = @"https://keybase.io";
  AppDelegate.sharedDelegate.APIClient = [[KBAPIClient alloc] initWithAPIHost:host];
}

- (void)setStatus:(KBRGetCurrentStatusRes *)status {
  _status = status;
  self.user = status.user;

  [self.sourceView.statusView setStatus:status];

  [self updateMenu];

  if (_status.loggedIn && _status.user) {
    if (_sourceView.hidden) {
      [self showProfile];
    }
  } else {
    [self showLogin];
  }
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
  [self.delegate appView:self willConnectWithClient:_client];
}

- (void)RPClientDidConnect:(KBRPClient *)RPClient {
  [self.sourceView.statusView setConnected:YES];
  [self.delegate appView:self didConnectWithClient:_client];
  [self checkStatus:nil];
}

- (void)RPClientDidDisconnect:(KBRPClient *)RPClient {
  [self.sourceView.statusView setConnected:NO];
  [self.delegate appView:self didDisconnectWithClient:_client];
}

- (void)RPClient:(KBRPClient *)RPClient didErrorOnConnect:(NSError *)error connectAttempt:(NSInteger)connectAttempt {
  //if (connectAttempt == 1) [AppDelegate.sharedDelegate setFatalError:error]; // Show error on first error attempt
  [self.sourceView.statusView setConnected:NO];
  [self.delegate appView:self didDisconnectWithClient:RPClient];
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
  KBWindow *window = [KBWindow windowWithContentView:self size:CGSizeMake(800, 500) retain:YES];
  window.minSize = CGSizeMake(600, 400);
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
  return window;
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
