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
  _statusItem.title = @"KB";
  //_statusItem.image = [NSImage imageNamed:@"StatusIcon"];
  //_statusItem.alternateImage = [NSImage imageNamed:@""]; // Highlighted
  _statusItem.highlightMode = YES; // Blue background when selected

  self.windowController = [[KBWindowController alloc] initWithWindowNibName:@"KBWindowController"];
  [self.windowController window];

  _client = [[KBRPClient alloc] init];
  _client.delegate = self;
  [_client open];

  GHWeakSelf gself = self;
  [_client registerMethod:@"keybase.1.secretUi.getSecret" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    NSString *prompt = params[0][@"pinentry"][@"prompt"];
    NSString *description = params[0][@"pinentry"][@"desc"];
    [gself passwordPrompt:prompt description:description completion:^(BOOL canceled, NSString *password) {
      KBSecretEntryRes *entry = [[KBSecretEntryRes alloc] init];
      entry.text = password;
      entry.canceled = canceled;
      completion(nil, entry);
    }];
  }];

  // Just for mocking
  _APIClient = [[KBAPIClient alloc] initWithAPIHost:KBAPIKeybaseIOHost];
}

- (void)RPClientDidConnect:(KBRPClient *)RPClient {
  [self checkStatus];
}

- (void)RPClientDidLogout:(KBRPClient *)RPClient {
  [self checkStatus];
}

- (void)checkStatus {
  KBRConfig *config = [[KBRConfig alloc] initWithClient:_client];
  [config getCurrentStatus:^(NSError *error, KBGetCurrentStatusRes *status) {
    // TODO: check error
    GHDebug(@"Status: %@", status);
    [self setStatus:status];
  }];
}

- (void)passwordPrompt:(NSString *)prompt description:(NSString *)description completion:(void (^)(BOOL canceled, NSString *password))completion {
  NSAlert *alert = [[NSAlert alloc] init];
  [alert addButtonWithTitle:@"OK"];
  [alert addButtonWithTitle:@"Cancel"];

  [alert setMessageText:prompt];
  [alert setInformativeText:description];
  [alert setAlertStyle:NSWarningAlertStyle];

  NSTextField *input = [[NSSecureTextField alloc] initWithFrame:NSMakeRect(0, 0, 200, 24)];
  [alert setAccessoryView:input];

  [alert beginSheetModalForWindow:self.windowController.window completionHandler:^(NSModalResponse returnCode) {
    if (returnCode == NSAlertFirstButtonReturn) {
      completion(NO, input.stringValue);
    } else {
      completion(YES, nil);
    }
  }];
}

- (NSMenu *)connectMenu {
  NSMenu *menu = [[NSMenu alloc] init];
  [menu addItemWithTitle:@"Quit" action:@selector(quit:) keyEquivalent:@""];
  return menu;
}

- (void)setStatus:(KBGetCurrentStatusRes *)status {
  _status = status;
  _statusItem.menu = [self menu];

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
}

- (NSMenu *)menu {
  NSMenu *menu = [[NSMenu alloc] init];
  [menu addItemWithTitle:@"Log Out" action:@selector(logout:) keyEquivalent:@""];
  [menu addItem:[NSMenuItem separatorItem]];
  [menu addItemWithTitle:@"Quit" action:@selector(quit:) keyEquivalent:@""];
  return menu;
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

- (void)logout:(id)sender {
  [_client logout];
}

- (void)quit:(id)sender {
  [NSApplication.sharedApplication terminate:sender];
}

@end
