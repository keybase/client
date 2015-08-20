//
//  KBInstallerView.m
//  Keybase
//
//  Created by Gabriel on 2/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBInstaller.h"

//#include <launch.h>
#import "KBRunOver.h"
#import "KBInstallable.h"
#import "KBInstallAction.h"
#import "KBWorkspace.h"

#import "KBDefines.h"

@interface KBInstaller ()
@property KBEnvironment *environment;
@end

@implementation KBInstaller

- (instancetype)initWithEnvironment:(KBEnvironment *)environment {
  if ((self = [super init])) {
    _environment = environment;
  }
  return self;
}

- (void)install:(dispatch_block_t)completion {
  // Ensure application support dir is available
  [KBWorkspace applicationSupport:nil create:YES error:nil]; // TODO Handle error

  NSArray *installActionsNeeded = [_environment installActionsNeeded];

  KBRunOver *rover = [[KBRunOver alloc] init];
  rover.enumerator = [installActionsNeeded objectEnumerator];
  rover.runBlock = ^(KBInstallAction *installAction, KBRunCompletion runCompletion) {
    DDLogDebug(@"Install: %@", installAction.name);
    [installAction.installable install:^(NSError *error) {
      installAction.installAttempted = YES;
      installAction.installError = error;

      if (!error) {
        [installAction.installable refreshComponent:^(NSError *error) {
          runCompletion(installAction);
        }];
      } else {
        runCompletion(installAction);
      }
    }];
  };
  rover.completion = ^(NSArray *installActions) {
    completion();
  };
  [rover run];
}

- (void)installStatus:(void (^)(BOOL needsInstall))completion {
  KBRunOver *rover = [[KBRunOver alloc] init];
  rover.enumerator = [_environment.installActions objectEnumerator];
  rover.runBlock = ^(KBInstallAction *installAction, KBRunCompletion runCompletion) {
    DDLogDebug(@"Checking %@", installAction.installable.name);
    [installAction.installable refreshComponent:^(NSError *error) {
      // Clear install outcome
      installAction.installAttempted = NO;
      installAction.installError = error;
      runCompletion(installAction);
    }];
  };

  NSArray *installActionsNeeded = [_environment installActionsNeeded];
  rover.completion = ^(NSArray *installActions) {
    //DDLogDebug(@"Install actions needed: %@", installActionsNeeded);
    completion([installActionsNeeded count] > 0);
  };
  [rover run];
}

- (void)uninstall:(KBCompletion)completion {
  KBRunOver *rover = [[KBRunOver alloc] init];
  rover.enumerator = [_environment.installables reverseObjectEnumerator];
  rover.runBlock = ^(id<KBInstallable> installable, KBRunCompletion runCompletion) {
    [installable uninstall:^(NSError *error) {
      runCompletion(installable);
    }];
  };
  rover.completion = ^(NSArray *outputs) {
    completion(nil);
  };
  [rover run];
}

/*
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
 */

@end
