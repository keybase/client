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

@interface AppDelegate ()
@property KBMainView *mainView;
@property KBConnectView *connectView;
@property KBPreferences *preferences;
@property NSStatusItem *statusItem;
@property KBRPClient *client;

@property KBAPIClient *APIClient;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
  _statusItem = [[NSStatusBar systemStatusBar] statusItemWithLength:NSVariableStatusItemLength];
  //_statusItem.title = @"Keybase";
  _statusItem.image = [NSImage imageNamed:@"StatusIcon"];
  //_statusItem.alternateImage = [NSImage imageNamed:@""]; // Highlighted
  _statusItem.highlightMode = YES; // Blue background when selected

  _mainView = [[KBMainView alloc] init];

//  self.windowController = [[KBWindowController alloc] initWithWindowNibName:@"KBWindowController"];
//  [self.windowController window];
//  [self.windowController showLogin:NO];

  _client = [[KBRPClient alloc] init];
  _client.delegate = self;
  [_client open];

  [_client registerMethod:@"keybase.1.secretUi.getSecret" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    GHDebug(@"Password prompt: %@", params);
    NSString *prompt = params[0][@"pinentry"][@"prompt"];
    NSString *description = params[0][@"pinentry"][@"desc"];
    [KBAlert promptForInputWithTitle:prompt description:description secure:YES style:NSWarningAlertStyle buttonTitles:@[@"OK", @"Cancel"] view:nil completion:^(NSModalResponse response, NSString *password) {
      KBRSecretEntryRes *entry = [[KBRSecretEntryRes alloc] init];
      entry.text = response == NSAlertFirstButtonReturn ? password : nil;
      entry.canceled = response == NSAlertSecondButtonReturn;
      completion(nil, entry);
    }];
  }];

  // Just for mocking, getting at data the RPC client doesn't give us yet
  _APIClient = [[KBAPIClient alloc] initWithAPIHost:KBAPIKeybaseIOHost];

  // Catalog for debugging
  [self catalog];
}

- (void)RPClientDidConnect:(KBRPClient *)RPClient {
  [self checkStatus];
}

- (void)RPClientDidLogout:(KBRPClient *)RPClient {
  [self checkStatus];
}

- (void)checkStatus {
  KBRConfigRequest *config = [[KBRConfigRequest alloc] initWithClient:_client];
  [config getCurrentStatus:^(NSError *error, KBRGetCurrentStatusRes *status) {
    // TODO: check error
    //GHDebug(@"Status: %@", status);
    [self setStatus:status];
  }];
}

- (void)logout {
  KBRLoginRequest *login = [[KBRLoginRequest alloc] initWithClient:_client];
  [login logout:^(NSError *error) {
    // TODO: check error
    [self checkStatus];
  }];
}

- (void)setStatus:(KBRGetCurrentStatusRes *)status {
  _status = status;

  if (!status.loggedIn) {
    [_mainView.window close];
    [self showLogin:status.user];
  } else {
    [_connectView.window close];
    [self showMainView];
  }
  [self updateMenu];
}

- (void)updateMenu {
  NSMenu *menu = [[NSMenu alloc] init];

  [menu addItemWithTitle:@"Preferences" action:@selector(preferences:) keyEquivalent:@""];

  if (_status.loggedIn) {
    // TODO: update when username bug fixed
    NSString *username = [_status.user.username gh_isPresent] ? _status.user.username : [_status.user.uid na_hexString];
    [menu addItemWithTitle:NSStringWithFormat(@"Log Out (%@)", username) action:@selector(logout) keyEquivalent:@""];
    [menu addItem:[NSMenuItem separatorItem]];
  }

  [menu addItem:[NSMenuItem separatorItem]];
  [menu addItemWithTitle:@"Quit" action:@selector(quit:) keyEquivalent:@""];

  _statusItem.menu = menu;
}

- (void)showMainView {
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

//- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)application {
//  return YES;
//}

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

- (void)catalog {
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

#pragma mark Error

+ (void)setError:(NSError *)error sender:(NSView *)sender {
  NSParameterAssert(error);
  NSWindow *window = sender.window;
  if (!window) window = [NSApp mainWindow];
  [[NSAlert alertWithError:error] beginSheetModalForWindow:window completionHandler:nil];
  [sender becomeFirstResponder];
}

@end
