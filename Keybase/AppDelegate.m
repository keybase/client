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

@interface AppDelegate ()
@property KBWindowController *windowController;
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
    [AppDelegate passwordPrompt:prompt description:description view:nil completion:^(BOOL canceled, NSString *password) {
      KBRSecretEntryRes *entry = [[KBRSecretEntryRes alloc] init];
      entry.text = password;
      entry.canceled = canceled;
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

+ (void)passwordPrompt:(NSString *)prompt description:(NSString *)description view:(NSView *)view completion:(void (^)(BOOL canceled, NSString *password))completion {
  NSAlert *alert = [[NSAlert alloc] init];
  [alert addButtonWithTitle:@"OK"];
  [alert addButtonWithTitle:@"Cancel"];

  [alert setMessageText:prompt];
  [alert setInformativeText:description];
  [alert setAlertStyle:NSWarningAlertStyle];

  NSTextField *input = [[NSSecureTextField alloc] initWithFrame:NSMakeRect(0, 0, 200, 24)];
  [alert setAccessoryView:input];

  void (^response)(NSModalResponse returnCode) = ^(NSModalResponse returnCode) {
    if (returnCode == NSAlertFirstButtonReturn) {
      completion(NO, input.stringValue);
    } else {
      completion(YES, nil);
    }
  };

  NSWindow *window = view.window;
  if (!window) window = [NSApp mainWindow];

  if (window) {
    [alert beginSheetModalForWindow:window completionHandler:response];
  } else {
    NSModalResponse returnCode = [alert runModal];
    response(returnCode);
  }
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
  if (_status.loggedIn) {
    // TODO: update when username bug fixed
    NSString *username = [_status.user.username gh_isPresent] ? _status.user.username : [_status.user.uid na_hexString];
    [menu addItemWithTitle:NSStringWithFormat(@"Log Out (%@)", username) action:@selector(logout) keyEquivalent:@""];
    [menu addItem:[NSMenuItem separatorItem]];
  }
  [menu addItemWithTitle:@"Quit" action:@selector(quit:) keyEquivalent:@""];

  _statusItem.menu = menu;
}

- (void)applicationWillTerminate:(NSNotification *)notification {

}

//- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)application {
//  return NO;
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

- (void)contacts:(id)sender { }

- (void)quit:(id)sender {
  [NSApplication.sharedApplication terminate:sender];
}

- (void)catalog {
  if (!_catalogController) {
    _catalogController = [[KBWindowController alloc] initWithWindowNibName:@"KBWindowController"];
    [_catalogController window];
  }
  [_catalogController showCatalog];
}

@end
