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
#import "KBCatalogView.h"
#import "KBLoginView.h"
#import "KBSignupView.h"
#import "KBInstaller.h"

@interface KBAppView ()
//@property KBListView *sourceView;
@property KBSourceOutlineView *sourceView;
@property KBBox *border;

@property (readonly) YONSView *contentView;
@property KBUsersAppView *usersMainView;

@property KBUserProfileView *userProfileView;
@property (nonatomic) KBLoginView *loginView;
@property (nonatomic) KBSignupView *signupView;

@property NSStatusItem *statusItem; // Menubar
@property KBRPClient *client;
@property (nonatomic) KBRGetCurrentStatusRes *status;
@end

@implementation KBAppView

- (void)viewInit {
  [super viewInit];

  _statusItem = [[NSStatusBar systemStatusBar] statusItemWithLength:NSVariableStatusItemLength];
  //_statusItem.title = @"Keybase";
  _statusItem.image = [NSImage imageNamed:@"StatusIcon"];
  //_statusItem.alternateImage = [NSImage imageNamed:@""]; // Highlighted
  _statusItem.highlightMode = YES; // Blue background when selected

  [self updateMenu];

  _sourceView = [[KBSourceOutlineView alloc] init];
  _sourceView.delegate = self;
  [self addSubview:_sourceView];

//  _sourceView = [KBListView listViewWithPrototypeClass:KBLabel.class rowHeight:0];
//  _sourceView.cellSetBlock = ^(KBLabel *view, NSString *s, NSIndexPath *indexPath, id containingView, BOOL dequeued) {
//    [view setText:s style:KBLabelStyleDefault];
//  };
//  [_sourceView addObjects:@[@"Profile", @"Users", @"Devices", @"Folders", @"Debug"]];
//  GHWeakSelf gself = self;
//  _sourceView.selectBlock = ^(id sender, NSIndexPath *indexPath, NSString *option) {
//    if ([option isEqualTo:@"Profile"]) [gself showProfile];
//    if ([option isEqualTo:@"Users"]) [gself showUsers];
//    if ([option isEqualTo:@"Devices"]) [gself setContentView:nil];
//    if ([option isEqualTo:@"Folders"]) [gself setContentView:nil];
//    if ([option isEqualTo:@"Debug"]) [gself showDebug];
//  };
//  [self addSubview:_sourceView];

  _border = [KBBox lineWithWidth:1.0 color:[KBAppearance.currentAppearance lineColor]];
  [self addSubview:_border];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat col1 = 150;

    CGFloat x = 0;
    CGFloat y = 27;
    if (!yself.sourceView.hidden) {
      [layout setFrame:CGRectMake(x, y, col1 - 1, size.height - y) view:yself.sourceView];
      x += col1;
    }
    y = 0;
    [layout setFrame:CGRectMake(x - 1, y, 1, size.height - y) view:yself.border];

    [layout setFrame:CGRectMake(x, y, size.width - x, size.height - y) view:yself.contentView];
    return size;
  }];
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

- (void)connect {
  GHWeakSelf gself = self;
  _client = [[KBRPClient alloc] init];
  _client.delegate = self;

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
    completion(nil, nil);
  }];

  KBInstaller *installer = [[KBInstaller alloc] init];
  [installer checkInstall:^(NSError *error, BOOL installed, KBInstallType installType) {
    GHDebug(@"Installed? %@, Type: %@", @(installed), @(installType));
    if (error) {
      [AppDelegate.sharedDelegate setFatalError:error];
      return;
    }
    [gself.client open];
  }];
}

- (void)setContentView:(YONSView *)contentView showSourceView:(BOOL)showSourceView {
  self.sourceView.hidden = !showSourceView;
  [_contentView removeFromSuperview];
  _contentView = contentView;
  if (_contentView) {
    [self addSubview:_contentView];
  }
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
  _loginView.client = AppDelegate.client;
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
  return _signupView;
}

- (void)showLogin {
  KBLoginView *view = [self loginView];
  [view removeFromSuperview];
  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:view title:@"Keybase"];
  [self setContentView:navigation showSourceView:NO];
}

- (void)showSignup {
  KBSignupView *view = [self signupView];
  [view removeFromSuperview];
  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:view title:@"Keybase"];
  [self setContentView:navigation showSourceView:NO];
}

- (void)showUsers {
  if (!_usersMainView) _usersMainView = [[KBUsersAppView alloc] init];
  [_usersMainView setUser:_user];
  [self setContentView:_usersMainView showSourceView:YES];
}

- (void)showProfile {
  NSAssert(_user, @"No user");
  _userProfileView = [[KBUserProfileView alloc] init];
  [_userProfileView setUser:_user editable:YES client:AppDelegate.client];
  [self setContentView:_userProfileView showSourceView:YES];
}

- (void)showDebug {
  KBCatalogView *catalogView = [[KBCatalogView alloc] init];
  [self setContentView:catalogView showSourceView:YES];
}

- (void)logout {
  [KBAlert promptWithTitle:@"Log Out" description:@"Are you sure you want to log out?" style:NSInformationalAlertStyle buttonTitles:@[@"Yes, Log Out", @"No"] view:self completion:^(NSModalResponse response) {
    if (response == NSAlertFirstButtonReturn) {
      [self setProgressEnabled:YES];
      KBRLoginRequest *login = [[KBRLoginRequest alloc] initWithClient:AppDelegate.client];
      [login logout:^(NSError *error) {
        [self setProgressEnabled:NO];
        if (error) {
          [AppDelegate setError:error sender:self];
          return;
        }

        [self checkStatus];
      }];
    }
  }];
}

- (void)setStatus:(KBRGetCurrentStatusRes *)status {
  _status = status;
  self.user = status.user;

  [self updateMenu];

  if (_status.loggedIn && _status.user) {
    [self showProfile];
  } else {
    [self showLogin];
  }
}

- (void)setUser:(KBRUser *)user {
  _user = user;
  [self setContentView:nil showSourceView:YES];
  [self.loginView setUser:user];
}

- (void)signupView:(KBSignupView *)signupView didSignupWithStatus:(KBRGetCurrentStatusRes *)status {
  self.status = status;
}

- (void)loginView:(KBLoginView *)loginView didLoginWithStatus:(KBRGetCurrentStatusRes *)status {
  self.status = status;
}

- (void)RPClientDidConnect:(KBRPClient *)RPClient {
  [self checkStatus];
}

- (void)RPClientDidDisconnect:(KBRPClient *)RPClient { }

- (void)RPClient:(KBRPClient *)RPClient didErrorOnConnect:(NSError *)error connectAttempt:(NSInteger)connectAttempt {
  if (connectAttempt == 1) [AppDelegate.sharedDelegate setFatalError:error]; // Show error on first error attempt
}

- (void)checkStatus {
  KBRConfigRequest *config = [[KBRConfigRequest alloc] initWithClient:_client];
  [config getCurrentStatus:^(NSError *error, KBRGetCurrentStatusRes *status) {
    if (error) {
      [AppDelegate.sharedDelegate setFatalError:error];
      return;
    }
    // TODO: check error
    //GHDebug(@"Status: %@", status);
    self.status = status;
  }];
}

- (void)sourceOutlineView:(KBSourceOutlineView *)sourceView didSelectItem:(KBSourceViewItem)item {
  switch (item) {
  case KBSourceViewItemDevices:
    [self setContentView:nil showSourceView:YES];
    break;
  case KBSourceViewItemFolders:
    [self setContentView:nil showSourceView:YES];
    break;
  case KBSourceViewItemProfile:
    [self showProfile];
    break;
  case KBSourceViewItemUsers:
    [self showUsers];
    break;
  case KBSourceViewItemDebug:
    [self showDebug];
    break;
  }
}

- (NSWindow *)createWindow {
  NSAssert(!self.superview, @"Already has superview");
  NSWindow *window = [KBWindow windowWithContentView:self size:CGSizeMake(800, 500) retain:YES];
  window.minSize = CGSizeMake(600, 400);
  //window.restorable = YES;
  window.delegate = self;
  //window.maxSize = CGSizeMake(600, 900);
  window.titleVisibility = NO;
  window.styleMask = NSClosableWindowMask | NSFullSizeContentViewWindowMask | NSTitledWindowMask | NSResizableWindowMask | NSMiniaturizableWindowMask;

  window.restorable = YES;
  //window.restorationClass = self.class;
  //window.navigation.titleView = [KBTitleView titleViewWithTitle:@"Keybase" navigation:window.navigation];
  //[window setLevel:NSStatusWindowLevel];
  return window;
}

- (void)openWindow {
  if (self.window) {
    [self.window makeKeyAndOrderFront:nil];
    return;
  }

  NSWindow *window = [self createWindow];
  [window center];
  [window makeKeyAndOrderFront:nil];
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
