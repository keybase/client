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
@property NSString *servicePath;
@property NSString *runMode;
@end

@implementation Installer

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
  [KBWorkspace setupLogging];

  NSArray *args = NSProcessInfo.processInfo.arguments;
  GBSettings *settings = [GBSettings settingsWithName:@"CLI" parent:nil];
  [settings setObject:@"/Users/gabe/Projects/go/src/github.com/keybase/client/osx/Install/bin" forKey:@"service-path"];
  [settings setObject:@"prod" forKey:@"run-mode"];
  GBCommandLineParser *parser = [[GBCommandLineParser alloc] init];
  [parser registerOption:@"service-path" shortcut:'s' requirement:GBValueOptional];
  [parser registerOption:@"run-mode" shortcut:'r' requirement:GBValueRequired];
  [parser registerSettings:settings];
  NSArray *subargs = [args subarrayWithRange:NSMakeRange(1, args.count-1)];
  [parser parseOptionsWithArguments:subargs commandLine:args[0]];
  self.runMode = [settings objectForKey:@"run-mode"];
  NSAssert(self.runMode, @"No run mode");
  self.servicePath = [settings objectForKey:@"service-path"];

  [self install:^(NSError *error) {
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
  KBEnvironment *environment = [KBEnvironment environmentForRunModeString:runMode servicePath:self.servicePath];
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
