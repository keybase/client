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
@property (strong) KBConnectWindowController *connectController;
@property KBRPClient *client;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
  _client = [[KBRPClient alloc] init];
  [_client open];
  
  self.connectController = [[KBConnectWindowController alloc] init];
  [self.connectController.window center];
  [self.connectController showWindow:nil];
}

- (void)applicationWillTerminate:(NSNotification *)aNotification {

}

+ (KBRPClient *)client {
  return ((AppDelegate *)[NSApp delegate]).client;
}

@end
