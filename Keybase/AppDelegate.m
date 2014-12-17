//
//  AppDelegate.m
//  Keybase
//
//  Created by Gabriel on 12/11/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "AppDelegate.h"

@interface AppDelegate ()
@property (weak) IBOutlet NSWindow *window;
@property KBRPClient *client;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
  _client = [[KBRPClient alloc] init];
  [_client open:^(NSError *error) {
    if (error) {
      [self reset];
    } else {
      [self checkSession];
    }
  }];
}

- (void)applicationWillTerminate:(NSNotification *)aNotification {

}

+ (KBRPClient *)client {
  return ((AppDelegate *)[NSApp delegate]).client;
}

- (void)checkSession {
  
}

- (void)reset {
  
}

@end
