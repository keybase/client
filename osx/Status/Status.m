//
//  Status.m
//  Keybase
//
//  Created by Gabriel on 1/11/16.
//  Copyright © 2016 Keybase. All rights reserved.
//

#import "Status.h"

#import <KBKit/KBKit.h>

#import "Settings.h"

@interface Status ()
@property Settings *settings;
@end

@implementation Status

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
  [KBWorkspace setupLogging];
  DDLogDebug(@"Starting");

  [KBAppearance setCurrentAppearance:[KBUIAppearance appearance]];

  GBSettings *settings = [GBSettings settingsWithName:@"Settings" parent:nil];
  [settings setObject:@"/Applications/Keybase.app" forKey:@"app-path"];
  [settings setObject:@"prod" forKey:@"run-mode"];
  _settings = [[Settings alloc] initWithSettings:settings];

  KBEnvironment *environment = [_settings environment];
  [self showStatus:environment completion:^(NSError *error) {
    [self quit:self];
  }];
}

+ (instancetype)sharedDelegate {
  return (Status *)[NSApp delegate];
}

- (IBAction)quit:(id)sender {
  [NSApplication.sharedApplication terminate:sender];
}

- (void)showModalWindow:(NSView *)view {
  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:view title:@"Keybase"];
  KBWindow *window = [KBWindow windowWithContentView:navigation size:CGSizeMake(700, 600) retain:YES];
  window.styleMask = NSFullSizeContentViewWindowMask | NSTitledWindowMask | NSResizableWindowMask | NSClosableWindowMask;
  [window center];
  window.level = NSFloatingWindowLevel;
  [window makeKeyAndOrderFront:nil];
}

- (void)showStatus:(KBEnvironment *)environment completion:(KBCompletion)completion {
  KBInstallStatusView *view = [[KBInstallStatusView alloc] init];
  [view setDebugOptionsViewEnabled:NO];
  [view setEnvironment:environment];
  [view setTitle:@"Keybase Status" headerText:@"Below is a report of Keybase components and their status."];

  [view clear];
  [view refresh];

  KBButton *closeButton = [KBButton buttonWithText:@"Close" style:KBButtonStyleDefault];
  closeButton.targetBlock = ^{ completion(nil); };
  [view setButtons:@[closeButton]];

  [self showModalWindow:view];
}

@end
