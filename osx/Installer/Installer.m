//
//  Installer.m
//  Keybase
//
//  Created by Gabriel on 11/23/15.
//  Copyright © 2015 Keybase. All rights reserved.
//

#import "Installer.h"

#import <KBKit/KBKit.h>
#import "Settings.h"

@interface Installer ()
@property Settings *settings;
//@property KBMemLogger *memLogger;
@end

typedef NS_ENUM (NSInteger, KBExit) {
  KBExitIgnore = 0,
  KBExitNormal = 0,
  KBExitQuit = 1,
  KBExitMoreDetails = 2,
};

@implementation Installer

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
  [KBWorkspace setupLogging];

  //_memLogger = [[KBMemLogger alloc] init];
  //[DDLog addLogger:_memLogger withLevel:DDLogLevelDebug];

  [KBAppearance setCurrentAppearance:[KBUIAppearance appearance]];

  GBSettings *settings = [GBSettings settingsWithName:@"Settings" parent:nil];
#if DEBUG
  [settings setObject:@"/Applications/Keybase.app" forKey:@"app-path"];
  //  [self.settings setObject:@"/Volumes/Keybase/Keybase.app" forKey:@"app-path"];
  [settings setObject:@"prod" forKey:@"run-mode"];
#endif
  _settings = [[Settings alloc] initWithSettings:settings];

  [self install:^(NSError *error, KBEnvironment *environment, KBExit exitCode) {
    if (!error) {
      [self afterInstall];
    }
    DDLogInfo(@"Exit(%@)", @(exitCode));
    dispatch_async(dispatch_get_main_queue(), ^{
      exit(exitCode);
    });
  }];
}

+ (instancetype)sharedDelegate {
  return (Installer *)[NSApp delegate];
}

- (IBAction)quit:(id)sender {
  [NSApplication.sharedApplication terminate:sender];
}

- (void)install:(void (^)(NSError *error, KBEnvironment *environment, KBExit exit))completion {
  KBEnvironment *environment = [self.settings environment];

  KBInstaller *installer = [[KBInstaller alloc] init];
  [installer installWithEnvironment:environment force:NO completion:^(NSError *error, NSArray *installables) {
    [self checkError:error environment:environment completion:^(NSError *error, KBExit exit) {
      completion(error, environment, exit);
    }];
  }];
}

- (void)afterInstall {
  /**
  if (!![self.settings objectForKey:@"run-at-login"]) {
    [self setRunAtLogin:[self.settings boolForKey:@"run-at-login"]];
  }
   */

  // TODO: Read setting from config instead of always enabling
  [self setRunAtLogin:YES];
}

- (void)setRunAtLogin:(BOOL)runAtLogin {
  NSBundle *appBundle = [NSBundle bundleWithPath:self.settings.appPath];
  if (!appBundle) {
    DDLogError(@"No app bundle to use for login item");
    return;
  }
  DDLogDebug(@"Set login item: %@ for %@", @(runAtLogin), appBundle);
  NSError *error = nil;
  [KBLoginItem setLoginEnabled:runAtLogin URL:appBundle.bundleURL error:&error];
  if (error) DDLogError(@"Error enabling login item: %@", error);
}

- (void)checkError:(NSError *)error environment:(KBEnvironment *)environment completion:(void (^)(NSError *error, KBExit exit))completion {
  if (!error) {
    completion(nil, KBExitNormal);
    return;
  }

  NSAlert *alert = [[NSAlert alloc] init];
  [alert setMessageText:@"Keybase Error"];
  [alert setInformativeText:error.localizedDescription];
  [alert addButtonWithTitle:@"Quit"];
  [alert addButtonWithTitle:@"Ignore"];
  [alert addButtonWithTitle:@"More Details"];
  [alert setAlertStyle:NSWarningAlertStyle];
  NSModalResponse response = [alert runModal];
  if (response == NSAlertFirstButtonReturn) {
    completion(error, KBExitQuit);
  } else if (response == NSAlertSecondButtonReturn) {
    completion(error, KBExitIgnore);
  } else if (response == NSAlertThirdButtonReturn) {
    completion(error, KBExitMoreDetails);
  }
}

@end
