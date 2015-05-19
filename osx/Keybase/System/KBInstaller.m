//
//  KBInstallerView.m
//  Keybase
//
//  Created by Gabriel on 2/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBInstaller.h"

#import "KBAppDefines.h"
#import "AppDelegate.h"
//#include <launch.h>
#import "KBRunOver.h"
#import "KBInstallable.h"
#import "KBInstallAction.h"

@interface KBInstaller ()
@property NSArray *installActions;
@end

@implementation KBInstaller

- (instancetype)initWithEnvironment:(KBEnvironment *)environment components:(NSArray *)components {
  if ((self = [super init])) {
    _installActions = [components map:^(id<KBInstallable> c) { return [KBInstallAction installActionWithComponent:c]; }];
  }
  return self;
}

- (void)installStatus:(void (^)(BOOL needsInstall))completion {
  KBRunOver *rover = [[KBRunOver alloc] init];
  rover.objects = _installActions;
  rover.runBlock = ^(KBInstallAction *installAction, KBRunCompletion runCompletion) {
    DDLogDebug(@"Checking %@", installAction.component.name);
    [installAction.component updateComponentStatus:^(NSError *error) {
      // Clear install outcome
      installAction.installAttempted = NO;
      installAction.installError = error;
      runCompletion(installAction);
    }];
  };
  rover.completion = ^(NSArray *installActions) {
    NSArray *installActionsNeeded = [self installActionsNeeded];
    completion([installActionsNeeded count] > 0);
  };
  [rover run];
}

- (NSArray *)installActionsNeeded {
  NSArray *installActions = [_installActions select:^BOOL(KBInstallAction *installAction) {
    return (installAction.component.componentStatus.installStatus != KBInstallStatusInstalled ||
            installAction.component.componentStatus.runtimeStatus == KBRuntimeStatusNotRunning);
  }];

  // Ignore KBFS since it's not ready yet
  installActions = [installActions select:^BOOL(KBInstallAction *installAction) {
    return ![installAction.name isEqual:@"KBFS"];
  }];

  return installActions;
}

- (void)install:(dispatch_block_t)completion {
  // Ensure application support dir is available
  [AppDelegate applicationSupport:nil create:YES error:nil]; // TODO Handle error

  NSArray *installActionsNeeded = [self installActionsNeeded];

  KBRunOver *rover = [[KBRunOver alloc] init];
  rover.objects = installActionsNeeded;
  rover.runBlock = ^(KBInstallAction *installAction, KBRunCompletion runCompletion) {
    DDLogDebug(@"Install: %@", installAction.name);
    [installAction.component install:^(NSError *error) {
      // Set install outcome
      installAction.installAttempted = YES;
      installAction.installError = error;

      if (!error) {
        // TODO hard coded delay here... how do we wait to see if new version loaded ok
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
          [installAction.component updateComponentStatus:^(NSError *error) {
            completion();
          }];
        });
      } else {
        completion();
      }
    }];
  };
  rover.completion = ^(NSArray *installActions) {
    completion();
  };
  [rover run];
}

- (void)removeDirectory:(NSString *)directory error:(NSError **)error {
  NSArray *files = [NSFileManager.defaultManager contentsOfDirectoryAtPath:directory error:error];
  for (NSString *file in files) {
    [NSFileManager.defaultManager removeItemAtPath:[directory stringByAppendingPathComponent:file] error:error];
  }
  [NSFileManager.defaultManager removeItemAtPath:directory error:error];
}

- (void)installDebugMocks {
  // TODO Remove from release
  NSString *recordZip = [[NSBundle mainBundle] pathForResource:@"record" ofType:@"zip"];
  NSString *recordDir = [AppDelegate applicationSupport:@[@"Record"] create:NO error:nil];
  //[self removeDirectory:recordDir error:nil];
  //[NSFileManager.defaultManager createDirectoryAtPath:recordDir withIntermediateDirectories:YES attributes:nil error:nil];
  NSTask *task = [[NSTask alloc] init];
  task.currentDirectoryPath = recordDir;
  task.launchPath = @"/usr/bin/unzip";
  task.arguments = @[recordZip];
  task.standardOutput = nil;
  task.standardError = nil;
  task.terminationHandler = ^(NSTask *t) {
    DDLogDebug(@"Task %@ exited with status: %@", t, @(t.terminationStatus));
  };
  [task launch];
}

@end
