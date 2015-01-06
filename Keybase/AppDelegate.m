//
//  AppDelegate.m
//  Keybase
//
//  Created by Gabriel on 12/11/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "AppDelegate.h"

#import "KBConnectWindowController.h"

@interface AppDelegate ()
@property KBConnectWindowController *connectController;
@property NSStatusItem *statusItem;
@property KBRPClient *client;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
  _client = [[KBRPClient alloc] init];
  GHDebug(@"Opening");
  [_client open];
  
  _statusItem = [[NSStatusBar systemStatusBar] statusItemWithLength:NSVariableStatusItemLength];
  _statusItem.title = @"KB";
  //_statusItem.image = [NSImage imageNamed:@"StatusIcon"];
  //_statusItem.alternateImage = [NSImage imageNamed:@""]; // Highlighted
  _statusItem.highlightMode = YES; // Blue background when selected
}

- (void)showLogin {
  if (!self.connectController) {
    _statusItem.menu = [self connectMenu];
    self.connectController = [[KBConnectWindowController alloc] init];
    [self.connectController.window setLevel:NSStatusWindowLevel];
    [self.connectController.window center];
  }
  [self.connectController showWindow:nil];
}

- (NSMenu *)connectMenu {
  NSMenu *menu = [[NSMenu alloc] init];
  [menu addItemWithTitle:@"Quit" action:@selector(quit:) keyEquivalent:@""];
  return menu;
}

- (NSMenu *)menu {
  NSMenu *menu = [[NSMenu alloc] init];
  [menu addItemWithTitle:@"Contacts" action:@selector(contacts:) keyEquivalent:@""];
  [menu addItemWithTitle:@"Log Out" action:@selector(logout:) keyEquivalent:@""];
  [menu addItem:[NSMenuItem separatorItem]];
  [menu addItemWithTitle:@"Quit" action:@selector(quit:) keyEquivalent:@""];
  return menu;
}

- (void)applicationWillTerminate:(NSNotification *)notification {

}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)application {
  return YES;
}

+ (KBRPClient *)client {
  return ((AppDelegate *)[NSApp delegate]).client;
}

+ (AppDelegate *)sharedDelegate {
  return (AppDelegate *)[[NSApplication sharedApplication] delegate];
}


- (void)contacts:(id)sender { }
- (void)logout:(id)sender { }
- (void)quit:(id)sender { }

@end
