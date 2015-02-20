//
//  AppDelegate.m
//  Keybase
//
//  Created by Gabriel on 12/11/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "AppDelegate.h"

#import "KBKeyGenView.h"
#import "KBRPC.h"
#import "KBUserProfileView.h"
#import "KBCatalogView.h"
#import "KBPreferences.h"
#import "KBMainView.h"
#import "KBErrorView.h"
#import "KBAppearance.h"

@interface AppDelegate ()
@property KBMainView *mainView;
@property KBConnectView *connectView;
@property KBPreferences *preferences;
@property KBRPClient *client;

@property NSStatusItem *statusItem; // Menubar

@property KBAPIClient *APIClient;
@property BOOL alerting;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
  [KBAppearance setCurrentAppearance:[[KBAppearanceLight alloc] init]];

  _statusItem = [[NSStatusBar systemStatusBar] statusItemWithLength:NSVariableStatusItemLength];
  //_statusItem.title = @"Keybase";
  _statusItem.image = [NSImage imageNamed:@"StatusIcon"];
  //_statusItem.alternateImage = [NSImage imageNamed:@""]; // Highlighted
  _statusItem.highlightMode = YES; // Blue background when selected

  [self updateMenu];

  _mainView = [[KBMainView alloc] init];

  _client = [[KBRPClient alloc] init];
  _client.delegate = self;

  [_client registerMethod:@"keybase.1.secretUi.getSecret" owner:self requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    GHDebug(@"Password prompt: %@", params);
    KBRGetSecretRequestParams *handler = [[KBRGetSecretRequestParams alloc] initWithParams:params];
    [KBAlert promptForInputWithTitle:handler.pinentry.prompt description:handler.pinentry.desc secure:YES style:NSCriticalAlertStyle buttonTitles:@[@"OK", @"Cancel"] view:nil completion:^(NSModalResponse response, NSString *password) {
      KBRSecretEntryRes *entry = [[KBRSecretEntryRes alloc] init];
      entry.text = response == NSAlertFirstButtonReturn ? password : nil;
      entry.canceled = response == NSAlertSecondButtonReturn;
      completion(nil, entry);
    }];
  }];

  [_client registerMethod:@"keybase.1.secretUi.getNewPassphrase" owner:self requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRGetNewPassphraseRequestParams *handler = [[KBRGetNewPassphraseRequestParams alloc] initWithParams:params];
    [KBAlert promptForInputWithTitle:handler.pinentryPrompt description:handler.pinentryDesc secure:YES style:NSCriticalAlertStyle buttonTitles:@[@"OK", @"Cancel"] view:nil completion:^(NSModalResponse response, NSString *password) {
      NSString *text = response == NSAlertFirstButtonReturn ? password : nil;
      completion(nil, text);
    }];
  }];

  [_client registerMethod:@"keybase.1.secretUi.getKeybasePassphrase" owner:self requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    GHDebug(@"Password prompt: %@", params);
    KBRGetKeybasePassphraseRequestParams *handler = [[KBRGetKeybasePassphraseRequestParams alloc] initWithParams:params];
    [KBAlert promptForInputWithTitle:@"Passphrase" description:NSStringWithFormat(@"What's your passphrase (for user %@)?", handler.username) secure:YES style:NSCriticalAlertStyle buttonTitles:@[@"OK", @"Cancel"] view:nil completion:^(NSModalResponse response, NSString *password) {
      NSString *text = response == NSAlertFirstButtonReturn ? password : nil;
      completion(nil, text);
    }];
  }];




  [_client registerMethod:@"keybase.1.logUi.log" owner:self requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    completion(nil, nil);
  }];

  [_client open];

  // Just for mocking, getting at data the RPC client doesn't give us yet
  _APIClient = [[KBAPIClient alloc] initWithAPIHost:KBAPIKeybaseIOHost];

  [self openCatalog];
}

- (void)RPClientDidConnect:(KBRPClient *)RPClient {
  [self checkStatus];
}

- (void)RPClientDidDisconnect:(KBRPClient *)RPClient {
  
}

- (void)RPClient:(KBRPClient *)RPClient didErrorOnConnect:(NSError *)error connectAttempt:(NSInteger)connectAttempt {
  if (connectAttempt == 1) [self setFatalError:error]; // Show error on first error attempt
}

- (void)checkStatus {
  KBRConfigRequest *config = [[KBRConfigRequest alloc] initWithClient:_client];
  [config getCurrentStatus:^(NSError *error, KBRGetCurrentStatusRes *status) {
    if (error) {
      [self setFatalError:error];
      return;
    }
    // TODO: check error
    //GHDebug(@"Status: %@", status);
    [self setStatus:status];
  }];
}

- (void)login {
  [_mainView.window close];
  [self showLogin:_status.user];
}

- (void)setStatus:(KBRGetCurrentStatusRes *)status {
  _status = status;

  if (!status.loggedIn || !status.user) {
    [self login];
  } else {
    [_connectView.window close];
    [self showMainView:status.user];
  }
  [self updateMenu];
}

- (void)updateMenu {
  NSMenu *menu = [[NSMenu alloc] init];

  [menu addItemWithTitle:@"Preferences" action:@selector(preferences:) keyEquivalent:@""];

  if (_status) {
    if (_status.loggedIn && _status.user) {
      [menu addItemWithTitle:NSStringWithFormat(@"Log Out (%@)", _status.user.username) action:@selector(logout) keyEquivalent:@""];
      [menu addItem:[NSMenuItem separatorItem]];
    } else {
      [menu addItemWithTitle:@"Log In" action:@selector(login) keyEquivalent:@""];
      [menu addItem:[NSMenuItem separatorItem]];
    }
  }

  [menu addItem:[NSMenuItem separatorItem]];
  [menu addItemWithTitle:@"Quit" action:@selector(quit:) keyEquivalent:@""];

  _statusItem.menu = menu;
}

- (void)showMainView:(KBRUser *)user {
  [_mainView setUser:user];
  [_mainView openWindow];
}

- (void)showLogin:(KBRUser *)user {
  if (!_connectView) {
    _connectView = [[KBConnectView alloc] init];
    _connectView.loginView.delegate = self;
    _connectView.signupView.delegate = self;
  }
  [_connectView showLogin:NO];
  [_connectView setUser:user];
  [_connectView openWindow:@"Keybase"];
}

- (void)signupView:(KBSignupView *)signupView didSignupWithStatus:(KBRGetCurrentStatusRes *)status {
  AppDelegate.sharedDelegate.status = status;
  [signupView.window close];
}

- (void)loginView:(KBLoginView *)loginView didLoginWithStatus:(KBRGetCurrentStatusRes *)status {
  AppDelegate.sharedDelegate.status = status;
  [loginView.window close];
}

- (void)applicationWillTerminate:(NSNotification *)notification {

}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)application {
  return NO;
}

+ (KBRPClient *)client {
  return ((AppDelegate *)[NSApp delegate]).client;
}

+ (KBAPIClient *)APIClient {
  return ((AppDelegate *)[NSApp delegate]).APIClient;
}


+ (AppDelegate *)sharedDelegate {
  return (AppDelegate *)[[NSApplication sharedApplication] delegate];
}

- (void)preferences:(id)sender {
  if (!_preferences) _preferences = [[KBPreferences alloc] init];
  [_preferences open];
}

- (void)quit:(id)sender {
  [NSApplication.sharedApplication terminate:sender];
}

- (void)openCatalog {
  KBCatalogView *catalogView = [[KBCatalogView alloc] init];
  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:catalogView];
  NSWindow *window = [KBWindow windowWithContentView:navigation size:CGSizeMake(400, 500) retain:YES];
  window.minSize = CGSizeMake(300, 400);
  window.maxSize = CGSizeMake(600, 900);
  window.styleMask = window.styleMask | NSResizableWindowMask;
  navigation.titleView = [KBTitleView titleViewWithTitle:@"Debug/Catalog" navigation:navigation];
  //[window setLevel:NSStatusWindowLevel];
  [window makeKeyAndOrderFront:nil];
}

+ (NSString *)loadFile:(NSString *)file {
  NSString *path = [[NSBundle mainBundle] pathForResource:[file stringByDeletingPathExtension] ofType:[file pathExtension]];
  NSString *contents = [NSString stringWithContentsOfFile:path encoding:NSUTF8StringEncoding error:NULL];
  NSAssert(contents, @"No contents at file: %@", file);
  return contents;
}

#pragma mark Progress

+ (void)setInProgress:(BOOL)inProgress view:(NSView *)view {
  [self.class _setInProgress:view inProgress:inProgress subviews:view.subviews];
}

+ (void)_setInProgress:(NSView *)view inProgress:(BOOL)inProgress subviews:(NSArray *)subviews {
  for (NSView *view in subviews) {
    if ([view isKindOfClass:NSControl.class]) {
      ((NSControl *)view).enabled = !inProgress;
    } else {
      [self _setInProgress:view inProgress:inProgress subviews:view.subviews];
    }
  }
}

- (void)closeAllWindows {
  [_mainView.window close];
  [_connectView.window close];
  [_preferences close];
}

#pragma mark Error

- (void)setFatalError:(NSError *)error {
  [self closeAllWindows];
  KBErrorView *fatalErrorView = [[KBErrorView alloc] init];
  [fatalErrorView setError:error];
  [fatalErrorView openInWindow];
}

+ (void)setError:(NSError *)error sender:(NSView *)sender {
  [AppDelegate.sharedDelegate setError:error sender:sender];
}

- (void)setError:(NSError *)error sender:(NSView *)sender {
  NSParameterAssert(error);

  if (_alerting) {
    GHDebug(@"Already showing error (%@)", error);
    return;
  }

  NSWindow *window = sender.window;
  if (!window) window = [NSApp mainWindow];
  _alerting = YES;
  GHWeakSelf gself = self;
  if (window) {
    [[NSAlert alertWithError:error] beginSheetModalForWindow:window completionHandler:^(NSModalResponse returnCode) {
      gself.alerting = NO;
    }];
  } else {
    [[NSAlert alertWithError:error] runModal];
  }
  [sender becomeFirstResponder];
}

@end
