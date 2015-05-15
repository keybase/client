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
#import "KBComponent.h"
#import "KBInstallAction.h"

@interface KBInstaller ()
@property NSArray *installActions;
@end

@implementation KBInstaller

- (instancetype)initWithEnvironment:(KBEnvironment *)environment components:(NSArray *)components {
  if ((self = [super init])) {
    _installActions = [components map:^(id<KBComponent> c) { return [KBInstallAction installActionWithComponent:c]; }];
  }
  return self;
}

- (void)installStatus:(void (^)(BOOL needsInstall))completion {
  KBRunOver *rover = [[KBRunOver alloc] init];
  rover.objects = _installActions;
  rover.runBlock = ^(KBInstallAction *installAction, KBRunCompletion runCompletion) {
    [installAction.component status:^(KBComponentStatus *status) {
      installAction.status = status;
      // Clear install outcome
      installAction.installAttempted = NO;
      installAction.installError = nil;
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
  return [_installActions select:^BOOL(KBInstallAction *installAction) {
    return (installAction.status.installStatus != KBInstallStatusInstalled ||
            installAction.status.runtimeStatus == KBRuntimeStatusNotRunning);
  }];
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
        [installAction.component status:^(KBComponentStatus *status) {
          installAction.status = status;
          completion();
        }];
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
