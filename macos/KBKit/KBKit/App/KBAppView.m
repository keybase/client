//
//  KBAppView.m
//  Keybase
//
//  Created by Gabriel on 2/4/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBAppView.h"

#import "KBApp.h"
#import "KBAppToolbar.h"
#import "KBSourceOutlineView.h"

#import "KBComponent.h"
#import "KBUsersAppView.h"
#import "KBDevicesAppView.h"
#import "KBFoldersAppView.h"
#import "KBPGPAppView.h"
#import "KBUserProfileView.h"
#import "KBLoginView.h"
#import "KBSignupView.h"
#import "KBEnvironment.h"
#import "KBDebugViews.h"
#import "KBInstaller.h"
#import "KBDebugViews.h"
#import "KBAppProgressView.h"
#import "KBSecretPromptView.h"
#import "KBInstallStatusAppView.h"
#import "KBAppDebug.h"
#import "KBNotifications.h"
#import "KBStatusView.h"
#import "KBTask.h"
#import "KBWorkspace.h"

typedef NS_ENUM (NSInteger, KBAppViewMode) {
  KBAppViewModeInProgress = 1,
  KBAppViewModeStatus,
  KBAppViewModeInstaller,
  KBAppViewModeLogin,
  KBAppViewModeSignup,
  KBAppViewModeMain
};

@interface KBAppView () <KBAppToolbarDelegate, KBComponent, KBSignupViewDelegate, KBLoginViewDelegate, KBRPClientDelegate, NSWindowDelegate>
@property KBAppToolbar *toolbar;
@property KBSourceOutlineView *sourceView;
@property (readonly) YOView *contentView;

@property KBAppProgressView *appProgressView;

@property KBUsersAppView *usersAppView;
@property KBDevicesAppView *devicesAppView;
@property KBFoldersAppView *foldersAppView;
@property KBPGPAppView *PGPAppView;

@property KBUserProfileView *userProfileView;
@property (nonatomic) KBLoginView *loginView;
@property (nonatomic) KBSignupView *signupView;

@property KBNavigationTitleView *titleView;

@property NSString *title;
@property KBAppViewMode mode;

@property KBEnvironment *environment;
@property KBRConfig *userConfig;
@property KBRGetCurrentStatusRes *userStatus;
@end

#define TITLE_HEIGHT (32)

@implementation KBAppView

- (void)viewInit {
  [super viewInit];

  _title = @"Keybase";

  _toolbar = [[KBAppToolbar alloc] init];
  _toolbar.hidden = YES;
  _toolbar.delegate = self;
  [self addSubview:_toolbar];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat x = 0;
    CGFloat y = 0;

    if (!yself.toolbar.hidden) {
      y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width, 0) view:yself.toolbar].size.height;
    }

    [layout setFrame:CGRectMake(x, y, size.width - x, size.height - y) view:yself.contentView];

    return size;
  }];

  [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(userDidChange:) name:KBUserDidChangeNotification object:nil];

  [self showInProgress:@"Loading"];
}

- (void)dealloc {
  [NSNotificationCenter.defaultCenter removeObserver:self];
}

- (void)openWithEnvironment:(KBEnvironment *)environment completion:(KBCompletion)completion {
  _environment = environment;

  NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
  DDLogInfo(@"Keybase.app Version: %@", info[@"CFBundleShortVersionString"]);

  [self install:completion];
}

- (void)install:(KBCompletion)completion {
  [self showInProgress:@"Loading"];
  KBInstaller *installer = [[KBInstaller alloc] init];
  [installer installWithEnvironment:_environment force:NO stopOnError:NO completion:^(NSError *error, NSArray *installables) {
    [self showInstallStatusView:completion];
  }];
}

- (void)connect:(KBCompletion)completion {
  KBRPClient *client = _environment.service.client;
  client.delegate = self;
  [client open:completion];
}

- (void)_checkStatus:(void (^)(NSError *error, KBRGetCurrentStatusRes *currentStatus, KBRConfig *config))completion {
  GHWeakSelf gself = self;
  KBRConfigRequest *statusRequest = [[KBRConfigRequest alloc] initWithClient:_environment.service.client];
  [statusRequest getCurrentStatus:^(NSError *error, KBRGetCurrentStatusRes *userStatus) {
    if (error) {
      completion(error, userStatus, nil);
      return;
    }
    KBRConfigRequest *configRequest = [[KBRConfigRequest alloc] initWithClient:gself.environment.service.client];
    [configRequest getConfig:^(NSError *error, KBRConfig *userConfig) {
      completion(error, userStatus, userConfig);
    }];
  }];
}

// If we errored while checking status
- (void)setStatusError:(NSError *)error {
  GHWeakSelf gself = self;

  if (gself.mode == KBAppViewModeInProgress) {
    NSMutableDictionary *errorInfo = [error.userInfo mutableCopy];
    errorInfo[NSLocalizedRecoveryOptionsErrorKey] = @[@"Retry", @"Quit"];
    error = [NSError errorWithDomain:error.domain code:error.code userInfo:errorInfo];

    [KBApp.app setError:error sender:self completion:^(NSModalResponse res) {
      // Option to retry or quit if we are trying to get status for the first time
      if (res == NSAlertFirstButtonReturn) {
        [self checkStatus];
      } else {
        [KBApp.app quitWithPrompt:YES sender:self];
      }
    }];
  } else {
    [KBApp.app setError:error sender:self completion:nil];
  }
}

- (void)setContentView:(YOView *)contentView mode:(KBAppViewMode)mode {
  _mode = mode;
  _toolbar.hidden = (mode != KBAppViewModeMain);
  [_contentView removeFromSuperview];
  _contentView = contentView;
  if (_contentView) [self addSubview:_contentView];
  if ([_contentView respondsToSelector:@selector(viewDidAppear:)]) [(id)_contentView viewDidAppear:NO];
  [self setNeedsLayout];
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
  _loginView.client = _environment.service.client;
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
  _signupView.client = _environment.service.client;
  return _signupView;
}

- (void)showInProgress:(NSString *)title {
  if (!_appProgressView || self.mode != KBAppViewModeInProgress) {
    _appProgressView = [[KBAppProgressView alloc] init];
    KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:_appProgressView title:_title];
    [self setContentView:navigation mode:KBAppViewModeInProgress];
  }
  [_appProgressView setProgressTitle:title];
  _appProgressView.animating = YES;
}

- (void)showErrorView:(NSString *)title error:(NSError *)error {
  KBStatusView *errorView = [[KBStatusView alloc] init];
  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:errorView title:_title];
  [self setContentView:navigation mode:KBAppViewModeStatus];
  GHWeakSelf gself = self;
  [errorView setError:error title:title retry:^{
    [gself showConnect:^(NSError *error) {}];
  } close:^{
    [KBApp.app quitWithPrompt:NO sender:self];
  }];
}

- (void)showBrewWarning:(dispatch_block_t)retry {
  KBStatusView *view = [[KBStatusView alloc] init];
  view.insets = UIEdgeInsetsMake(100, 100, 100, 100);
  [view setText:@"We've detected that you already have Keybase installed via Homebrew." description:@"We recommend that you uninstall the Homebrew installation since running both at the same time can causes issues." title:@"Homebrew Install Found" retry:retry close:^{
    [KBApp.app quitWithPrompt:NO sender:self];
  }];
  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:view title:_title];
  [self setContentView:navigation mode:KBAppViewModeStatus];
}

- (void)showWelcome {
  KBStatusView *view = [[KBStatusView alloc] init];
  view.insets = UIEdgeInsetsMake(100, 100, 100, 100);
  [view setText:@"Thanks for installing Keybase." description:@"Cliche echo park synth, shoreditch crucifix church-key hoodie. Banh mi kitsch portland pitchfork iPhone mlkshk keffiyeh bitters stumptown polaroid listicle. Chambray ethical brunch, dreamcatcher lomo single-origin coffee yuccie irony beard. Microdosing knausgaard raw denim ethical fashion axe. Waistcoat cornhole brooklyn, truffaut bushwick meh keffiyeh. Blog schlitz next level banh mi, umami hella ugh tote bag paleo cliche lo-fi 8-bit ennui kinfolk. Shabby chic fap fixie keytar." title:@"Welcome to Keybase" retry:nil close:^{
    [self.window close];
  }];
  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:view title:_title];
  [self setContentView:navigation mode:KBAppViewModeStatus];
}

- (void)showInstallStatusView:(KBCompletion)completion {
  KBInstallStatusAppView *view = [[KBInstallStatusAppView alloc] init];
  [view setEnvironment:self.environment];
  view.completion = ^() {
    [self showConnect:completion];
  };
  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:view title:_title];
  [self setContentView:navigation mode:KBAppViewModeInstaller];
}

- (void)showConnect:(KBCompletion)completion {
  [self showInProgress:@"Loading"];
  [self connect:completion];
}

- (void)showLogin {
  KBLoginView *view = [self loginView];
  [view removeFromSuperview];
  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:view title:_title];
  [self setContentView:navigation mode:KBAppViewModeLogin];
}

- (void)showSignup {
  KBSignupView *view = [self signupView];
  [view removeFromSuperview];
  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:view title:_title];
  [self setContentView:navigation mode:KBAppViewModeSignup];
}

- (void)showUsers {
  if (!_usersAppView) _usersAppView = [[KBUsersAppView alloc] init];
  _usersAppView.client = _environment.service.client;
  [self setContentView:_usersAppView mode:KBAppViewModeMain];
}

- (void)showProfile {
  NSAssert(_userStatus.user, @"No user");
  if (!_userProfileView) _userProfileView = [[KBUserProfileView alloc] init];
  [_userProfileView setUsername:_userStatus.user.username client:_environment.service.client];
  [self setContentView:_userProfileView mode:KBAppViewModeMain];
  _toolbar.selectedItem = KBAppViewItemProfile;
}

- (void)showDevices {
  if (!_devicesAppView) _devicesAppView = [[KBDevicesAppView alloc] init];
  _devicesAppView.client = _environment.service.client;
  [_devicesAppView refresh];
  [self setContentView:_devicesAppView mode:KBAppViewModeMain];
}

- (void)showFolders {
  if (!_foldersAppView) _foldersAppView = [[KBFoldersAppView alloc] init];
  _foldersAppView.client = _environment.service.client;
  [_foldersAppView reload];
  [self setContentView:_foldersAppView mode:KBAppViewModeMain];
}

- (void)showPGP {
  if (!_PGPAppView) _PGPAppView = [[KBPGPAppView alloc] init];
  _PGPAppView.client = _environment.service.client;
  [self setContentView:_PGPAppView mode:KBAppViewModeMain];
}

- (void)userDidChange:(NSNotification *)notification {
  [_userProfileView refresh];
}

- (void)logout:(BOOL)prompt {
  GHWeakSelf gself = self;
  dispatch_block_t logout = ^{
    [self showInProgress:@"Logging out"];
    KBRLoginRequest *request = [[KBRLoginRequest alloc] initWithClient:gself.environment.service.client];
    [request logout:^(NSError *error) {
      if (error) {
        [KBApp.app setError:error sender:self completion:nil];
      }
      [self checkStatus];
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

- (void)checkStatus {
  [self _checkStatus:^(NSError *error, KBRGetCurrentStatusRes *userStatus, KBRConfig *userConfig) {
    if (error) {
      [self setStatusError:error];
      return;
    }
    [self setUserStatus:userStatus userConfig:userConfig];
    // TODO reload current view if coming back from disconnect?
    [NSNotificationCenter.defaultCenter postNotificationName:KBStatusDidChangeNotification object:nil userInfo:@{@"userConfig": userConfig, @"userStatus": userStatus}];
  }];
}

/*
- (void)setConfig:(KBRConfig *)config {
  _config = config;
  NSString *host = _config.serverURI;
  // TODO Directly accessing API client should eventually go away (everything goes to daemon)
  if ([host isEqualTo:@"https://api.keybase.io:443"]) host = @"https://keybase.io";
  AppDelegate.sharedDelegate.APIClient = [[KBAPIClient alloc] initWithAPIHost:host];
}
 */

- (NSString *)APIURLString:(NSString *)path {
  NSAssert(_userConfig, @"No user config");
  NSString *host = _userConfig.serverURI;
  if ([host isEqualTo:@"https://api.keybase.io:443"]) host = @"https://keybase.io";
  return [NSString stringWithFormat:@"%@/%@", host, path];
}

- (void)setUserStatus:(KBRGetCurrentStatusRes *)userStatus userConfig:(KBRConfig *)userConfig {
  _userStatus = userStatus;
  _userConfig = userConfig;

  [self.loginView setUsername:userStatus.user.username];
  [self.sourceView.statusView setStatus:userStatus];
  [self.toolbar setUser:userStatus.user];

  // Don't change if we are in the installer
  if (_mode == KBAppViewModeInstaller) return;

  [self showWelcome];
  return;

  /*
  if (userStatus.loggedIn && userStatus.user) {
    // Show profile if logging in or we are already showing profile, refresh it
    if (_mode != KBAppViewModeMain || _toolbar.selectedItem == KBAppViewItemProfile) {
      [self showProfile];
    }
  } else if (_mode != KBAppViewModeLogin || _mode != KBAppViewModeSignup) {
    [self showLogin];
  }
   */
}

- (void)signupViewDidSignup:(KBSignupView *)signupView {
  [self showInProgress:@"Loading"];
  [self checkStatus];
}

- (void)loginViewDidLogin:(KBLoginView *)loginView {
  [self showInProgress:@"Loading"];
  [self checkStatus];
}

- (void)RPClientWillConnect:(KBRPClient *)RPClient { }

- (void)RPClientDidConnect:(KBRPClient *)RPClient {
  [self checkStatus];
}

- (void)RPClientDidDisconnect:(KBRPClient *)RPClient {
  DDLogInfo(@"Disconnected.");
  [self showInProgress:nil];
  [NSNotificationCenter.defaultCenter postNotificationName:KBStatusDidChangeNotification object:nil userInfo:@{}];
}

- (BOOL)RPClient:(KBRPClient *)RPClient didErrorOnConnect:(NSError *)error connectAttempt:(NSInteger)connectAttempt {
  if (connectAttempt >= 3) {
    [self showErrorView:@"Service Error" error:error];
    return NO;
  }
  return YES;
}

- (void)RPClient:(KBRPClient *)RPClient didLog:(NSString *)message {
  DDLogInfo(@"%@", message);
}

- (void)RPClient:(KBRPClient *)RPClient didRequestSecretForPrompt:(NSString *)prompt info:(NSString *)info details:(NSString *)details previousError:(NSString *)previousError completion:(KBRPClientOnSecret)completion {
  KBSecretPromptView *secretPrompt = [[KBSecretPromptView alloc] init];
  [secretPrompt setHeader:prompt info:info details:details previousError:previousError];
  secretPrompt.completion = completion;
  [secretPrompt openInWindow:(KBWindow *)self.window];
}

- (void)RPClient:(KBRPClient *)RPClient didRequestKeybasePassphraseForUsername:(NSString *)username completion:(KBRPClientOnPassphrase)completion {
  [KBAlert promptForInputWithTitle:@"Passphrase" description:NSStringWithFormat(@"What's your passphrase (for user %@)?", username) secure:YES style:NSCriticalAlertStyle buttonTitles:@[@"OK", @"Cancel"] view:self completion:^(NSModalResponse response, NSString *password) {
    password = response == NSAlertFirstButtonReturn ? password : nil;
    completion(password);
  }];
}

- (void)appToolbar:(KBAppToolbar *)appToolbar didSelectItem:(KBAppViewItem)item {
  switch (item) {
    case KBAppViewItemNone:
      NSAssert(NO, @"Can't select none");
      break;
    case KBAppViewItemDevices:
      [self showDevices];
      break;
    case KBAppViewItemFolders:
      [self showFolders];
      break;
    case KBAppViewItemProfile:
      [self showProfile];
      break;
    case KBAppViewItemUsers:
      [self showUsers];
      break;
    case KBAppViewItemPGP:
      [self showPGP];
      break;
  }
}

- (NSRect)window:(NSWindow *)window willPositionSheet:(NSWindow *)sheet usingRect:(NSRect)rect {
  CGFloat sheetPosition = 0;
  if (_mode == KBAppViewModeMain) sheetPosition = 74;
  else sheetPosition = 32;
  rect.origin.y += -sheetPosition;
  return rect;
}

/*
- (BOOL)windowShouldClose:(id)sender {
  [KBApp.app quitWithPrompt:YES sender:self];
  return NO;
}
 */

- (void)openWindow {
  if (self.window) {
    [NSApplication.sharedApplication activateIgnoringOtherApps:YES];
    [self.window orderFrontRegardless];
  } else {
    NSWindow *window = [KBWorkspace createMainWindow:self];
    [window center];
    [window makeKeyAndOrderFront:nil];
  }
}

//- (void)encodeRestorableStateWithCoder:(NSCoder *)coder { }
//- (void)restoreStateWithCoder:(NSCoder *)coder { }
//invalidateRestorableState

//+ (void)restoreWindowWithIdentifier:(NSString *)identifier state:(NSCoder *)state completionHandler:(void (^)(NSWindow *window, NSError *error))completionHandler {
//  KBAppView *appView = [[KBAppView alloc] init];
//  NSWindow *window = [appView createWindow];
//  completionHandler(window, nil);
//}

#pragma mark KBComponent

- (NSString *)name {
  return @"App";
}

- (NSString *)info {
  return @"The Keybase application";
}

- (NSImage *)image {
  return [KBIcons imageForIcon:KBIconGenericApp];
}

- (NSView *)componentView {
  return [[KBAppDebug alloc] init];
}

- (void)refreshComponent:(KBRefreshComponentCompletion)completion {
  completion(nil);
}

@end
