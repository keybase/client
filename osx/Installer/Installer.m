//
//  Installer.m
//  Keybase
//
//  Created by Gabriel on 11/23/15.
//  Copyright © 2015 Keybase. All rights reserved.
//

#import "Installer.h"

#import <KBKit/KBKit.h>
#import <GBCli/GBCli.h>

@interface Installer ()
@property NSString *appPath;
@property NSString *runMode;
@property GBSettings *settings;
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

  NSArray *args = NSProcessInfo.processInfo.arguments;
  self.settings = [GBSettings settingsWithName:@"CLI" parent:nil];
#if DEBUG
  [self.settings setObject:@"/Applications/Keybase.app" forKey:@"app-path"];
//  [self.settings setObject:@"/Volumes/Keybase/Keybase.app" forKey:@"app-path"];
  [self.settings setObject:@"prod" forKey:@"run-mode"];
#endif
  GBCommandLineParser *parser = [[GBCommandLineParser alloc] init];
  [parser registerOption:@"app-path" shortcut:'a' requirement:GBValueRequired];
  [parser registerOption:@"run-mode" shortcut:'r' requirement:GBValueRequired];
  [parser registerSettings:self.settings];
  NSArray *subargs = [args subarrayWithRange:NSMakeRange(1, args.count-1)];
  [parser parseOptionsWithArguments:subargs commandLine:args[0]];
  self.runMode = [self.settings objectForKey:@"run-mode"];
  NSAssert(self.runMode, @"No run mode");
  self.appPath = [self.settings objectForKey:@"app-path"];
  NSAssert(self.appPath, @"No app path");

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
  NSString *runMode = self.runMode;
  NSString *servicePath = [self.appPath stringByAppendingPathComponent:@"Contents/SharedSupport/bin"];
  KBEnvironment *environment = [KBEnvironment environmentForRunModeString:runMode servicePath:servicePath];

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
  NSBundle *appBundle = [NSBundle bundleWithPath:self.appPath];
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
    //[self showStatus:environment error:error completion:completion];
  }
}

//- (void)showModalWindow:(NSView *)view {
//  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:view title:@"Keybase"];
//  KBWindow *window = [KBWindow windowWithContentView:navigation size:CGSizeMake(700, 600) retain:YES];
//  window.styleMask = NSFullSizeContentViewWindowMask | NSTitledWindowMask | NSResizableWindowMask | NSClosableWindowMask;
//  [window center];
//  window.level = NSFloatingWindowLevel;
//  [window makeKeyAndOrderFront:nil];
//}

//- (void)showStatus:(KBEnvironment *)environment error:(NSError *)error completion:(KBCompletion)completion {
//  KBInstallStatusView *view = [[KBInstallStatusView alloc] init];
//  [view setDebugOptionsViewEnabled:NO];
//  [view setTitle:@"Error Report" headerText:@"Below is a report of what happened. You can send this to us, and we'll try to help fix it."];
//  [view setLog:_memLogger];
//
//  KBButton *closeButton = [KBButton buttonWithText:@"Close" style:KBButtonStyleDefault];
//  closeButton.targetBlock = ^{ completion(error); };
//  [view setButtons:@[closeButton]];
//
//  [view setEnvironment:environment];
//  [self showModalWindow:view];
//}

@end
