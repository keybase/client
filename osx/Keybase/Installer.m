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
@end

@implementation Installer

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
  [KBWorkspace setupLogging];

  NSArray *args = NSProcessInfo.processInfo.arguments;
  self.settings = [GBSettings settingsWithName:@"CLI" parent:nil];
#if DEBUG
  [self.settings setObject:@"/Applications/Keybase.app" forKey:@"app-path"];
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

  [self install:^(NSError *error) {
    [self afterInstall];
    [self quit:self];
  }];
}

+ (instancetype)sharedDelegate {
  return (Installer *)[NSApp delegate];
}

- (IBAction)quit:(id)sender {
  [NSApplication.sharedApplication terminate:sender];
}

- (void)install:(KBCompletion)completion {
  NSString *runMode = self.runMode; //NSBundle.mainBundle.infoDictionary[@"KBRunMode"];
  NSString *servicePath = [self.appPath stringByAppendingPathComponent:@"Contents/SharedSupport/bin"];
  KBEnvironment *environment = [KBEnvironment environmentForRunModeString:runMode servicePath:servicePath];

  KBInstaller *installer = [[KBInstaller alloc] init];
  [installer installWithEnvironment:environment force:NO completion:^(NSArray *installables) {
    for (KBInstallable *installable in installables) {
      NSString *name = installable.name;
      NSString *statusDescription = [[installable statusDescription] join:@"\n"];
      DDLogInfo(@"%@: %@", name, statusDescription);
    }
    completion(nil);
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

/*
 - (void)openKeybase {
 NSURL *URL = [NSBundle.mainBundle URLForResource:@"Keybase" withExtension:@"app"];
 [[NSWorkspace sharedWorkspace] launchApplicationAtURL:URL options:NSWorkspaceLaunchDefault configuration:@{} error:NULL];
 [self quit:self];
 }
 */

/*
 pid_t const pid = app.processIdentifier;

 if (self.source) {
 dispatch_cancel(self.source);
 self.source = nil;
 }

 self.source = dispatch_source_create(DISPATCH_SOURCE_TYPE_PROC, pid, DISPATCH_PROC_EXIT, DISPATCH_TARGET_QUEUE_DEFAULT);
 dispatch_source_set_event_handler(self.source, ^(){
 // If you would like continue watching for the app to quit,
 // you should cancel this source with dispatch_source_cancel and create new one
 // as with next run app will have another process identifier.
 });
 dispatch_resume(self.source);
 */

@end
