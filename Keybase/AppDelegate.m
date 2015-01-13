//
//  AppDelegate.m
//  Keybase
//
//  Created by Gabriel on 12/11/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "AppDelegate.h"

#import "KBConnectWindowController.h"
#import "KBKeyGenView.h"
#import "KBUsersViewController.h"
#import "KBUserProfileViewController.h"

@interface AppDelegate ()
@property KBConnectWindowController *connectController;
@property KBUsersViewController *usersViewController;
@property KBUserProfileViewController *userProfileViewController;
@property NSStatusItem *statusItem;
@property KBRPClient *client;

@property KBAPIClient *APIClient;

@property NSString *username;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
  _client = [[KBRPClient alloc] init];
  [_client open];

  _APIClient = [[KBAPIClient alloc] initWithAPIHost:KBAPIKeybaseIOHost];

  _statusItem = [[NSStatusBar systemStatusBar] statusItemWithLength:NSVariableStatusItemLength];
  _statusItem.title = @"KB";
  //_statusItem.image = [NSImage imageNamed:@"StatusIcon"];
  //_statusItem.alternateImage = [NSImage imageNamed:@""]; // Highlighted
  _statusItem.highlightMode = YES; // Blue background when selected
}

- (NSMenu *)connectMenu {
  NSMenu *menu = [[NSMenu alloc] init];
  [menu addItemWithTitle:@"Quit" action:@selector(quit:) keyEquivalent:@""];
  return menu;
}

- (void)setConnected:(BOOL)loggedIn hasKey:(BOOL)hasKey username:(NSString *)username {
  [self.connectController close];
  _username = username;
  _statusItem.menu = [self menu];

  if (!loggedIn || (loggedIn && !hasKey)) {
    self.connectController = [[KBConnectWindowController alloc] initWithWindowNibName:@"KBConnectWindowController"];
    [self.connectController.window setLevel:NSStatusWindowLevel];
    
    if (loggedIn && !hasKey) {
      KBKeyGenView *keyGenView = [[KBKeyGenView alloc] init];
      [self.connectController.navigationController pushView:keyGenView animated:NO];
    } else {
      _statusItem.menu = [self connectMenu];
    }
    [self.connectController showWindow:nil];
  } else {
    [self showUser:_username];
  }
}

- (NSMenu *)menu {
  NSMenu *menu = [[NSMenu alloc] init];
  [menu addItemWithTitle:@"Log Out" action:@selector(logout:) keyEquivalent:@""];
  [menu addItem:[NSMenuItem separatorItem]];
  [menu addItemWithTitle:@"Quit" action:@selector(quit:) keyEquivalent:@""];
  return menu;
}

- (void)showUser:(NSString *)username {
  self.userProfileViewController = [[KBUserProfileViewController alloc] initWithWindowNibName:@"KBUserProfileViewController"];
  [self.userProfileViewController loadUsername:username];
  [self.userProfileViewController showWindow:nil];
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
