//
//  AppDelegate.m
//  Keybase
//
//  Created by Gabriel on 12/11/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "AppDelegate.h"

#import "KBConnectWindowController.h"
#import "KBKeyGenViewController.h"

@interface AppDelegate ()
@property KBConnectWindowController *connectController;
@property NSStatusItem *statusItem;
@property KBRPClient *client;

@property NSString *username;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
  _client = [[KBRPClient alloc] init];
  [_client open];
  
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
    self.connectController = [[KBConnectWindowController alloc] init];
    [self.connectController.window setLevel:NSStatusWindowLevel];
    
    if (loggedIn && !hasKey) {
      KBKeyGenViewController *keyGenViewController = [[KBKeyGenViewController alloc] init];
      [self.connectController.navigationController pushViewController:keyGenViewController animated:NO];
    } else {
      _statusItem.menu = [self connectMenu];
    }
    [self.connectController showWindow:nil];
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
