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

@interface AppDelegate ()
@property KBWindowController *windowController;
@property KBPreferences *preferences;
@property NSStatusItem *statusItem;
@property KBRPClient *client;

@property KBAPIClient *APIClient;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
  _statusItem = [[NSStatusBar systemStatusBar] statusItemWithLength:NSVariableStatusItemLength];
  _statusItem.title = @"Keybase";
  //_statusItem.image = [NSImage imageNamed:@"StatusIcon"];
  //_statusItem.alternateImage = [NSImage imageNamed:@""]; // Highlighted
  _statusItem.highlightMode = YES; // Blue background when selected

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

  // Just for mocking
  _APIClient = [[KBAPIClient alloc] initWithAPIHost:KBAPIKeybaseIOHost];

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
    GHDebug(@"Status: %@", status);
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

  if (!status.loggedIn || (status.loggedIn && !status.publicKeySelected)) {
    if (status.loggedIn && !status.publicKeySelected) {
      [self.windowController showKeyGen:NO];
    } else {
      [self.windowController showLogin:NO];
    }
  } else {
    //[self.windowController showTwitterConnect:YES];
    [self.windowController showUser:status.user animated:NO];
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

- (void)applicationWillTerminate:(NSNotification *)notification {

}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)application {
  return YES;
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

- (void)catalog {
  KBCatalogView *catalogView = [[KBCatalogView alloc] init];
  KBWindow *window = [KBWindow windowWithContentView:catalogView size:CGSizeMake(400, 500) retain:YES];
  window.minSize = CGSizeMake(300, 400);
  window.maxSize = CGSizeMake(600, 900);
  window.styleMask = window.styleMask | NSResizableWindowMask;
  window.navigation.titleView = [KBTitleView titleViewWithTitle:@"Debug/Catalog" navigation:window.navigation];
  //[window setLevel:NSStatusWindowLevel];
  [window makeKeyAndOrderFront:nil];
}

+ (NSString *)loadFile:(NSString *)file {
  NSString *path = [[NSBundle mainBundle] pathForResource:[file stringByDeletingPathExtension] ofType:[file pathExtension]];
  NSString *contents = [NSString stringWithContentsOfFile:path encoding:NSUTF8StringEncoding error:NULL];
  NSAssert(contents, @"No contents at file: %@", file);
  return contents;
}

@end
