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
#import "KBLaunchService.h"
#import "KBHelperInstall.h"
#import "KBFuseInstall.h"
#import "KBCLIInstall.h"

@interface KBInstaller ()
@property NSArray *installActions;
@end

@implementation KBInstaller

- (instancetype)initWithEnvironment:(KBEnvironment *)environment {
  if ((self = [super init])) {

    NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
    NSMutableArray *installables = [NSMutableArray array];

    if (environment.isInstallEnabled) {
      if (environment.launchdLabelService) {
        [installables addObject:[[KBLaunchService alloc] initWithName:@"Service" label:environment.launchdLabelService bundleVersion:info[@"KBServiceVersion"] plist:environment.launchdPlistDictionaryForService]];
      }

      [installables addObject:[[KBHelperInstall alloc] init]];

      if (environment.launchdLabelKBFS) {
        [installables addObject:[[KBLaunchService alloc] initWithName:@"KBFS" label:environment.launchdLabelKBFS bundleVersion:info[@"KBFSVersion"] plist:environment.launchdPlistDictionaryForKBFS]];
      }

      [installables addObject:[[KBFuseInstall alloc] init]];

      [installables addObject:[[KBCLIInstall alloc] init]];
    }

    _installActions = [installables map:^(id<KBInstallable> installable) { return [KBInstallAction installActionWithInstallable:installable]; }];
  }
  return self;
}

- (void)installStatus:(void (^)(BOOL needsInstall))completion {
  KBRunOver *rover = [[KBRunOver alloc] init];
  rover.objects = _installActions;
  rover.runBlock = ^(KBInstallAction *installAction, KBRunCompletion runCompletion) {
    [installAction.installable installStatus:^(KBInstallStatus *status) {
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
    return (installAction.status.status != KBInstalledStatusInstalled ||
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
    DDLogDebug(@"Install: %@", installAction.installable.name);
    [installAction.installable install:^(NSError *error) {
      // Set install outcome
      installAction.installAttempted = YES;
      installAction.installError = error;

      if (!error) {
        [installAction.installable installStatus:^(KBInstallStatus *status) {
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
