//
//  KBInstallerView.m
//  Keybase
//
//  Created by Gabriel on 2/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBInstaller.h"

#import "KBDefines.h"
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
@property KBEnvironment *environment;
@end

@implementation KBInstaller

- (instancetype)initWithEnvironment:(KBEnvironment *)environment {
  if ((self = [super init])) {
    _environment = environment;
  }
  return self;
}

- (void)installStatus:(KBInstallActions)completion {
  if (!_environment.isInstallEnabled) {
    completion(@[]);
    return;
  }

  NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
  NSMutableArray *installables = [NSMutableArray array];

  if (_environment.launchdLabelService) {
    [installables addObject:[[KBLaunchService alloc] initWithName:@"Service" label:_environment.launchdLabelService version:info[@"KBServiceVersion"] plist:_environment.launchdPlistDictionaryForService]];
  }

  [installables addObject:[[KBHelperInstall alloc] init]];

  if (_environment.launchdLabelKBFS) {
    [installables addObject:[[KBLaunchService alloc] initWithName:@"KBFS" label:_environment.launchdLabelKBFS version:info[@"KBFSVersion"] plist:_environment.launchdPlistDictionaryForKBFS]];
  }

  [installables addObject:[[KBFuseInstall alloc] init]];

  [installables addObject:[[KBCLIInstall alloc] init]];

  KBRunOver *rover = [[KBRunOver alloc] init];
  rover.objects = installables;
  rover.runBlock = ^(id<KBInstallable> installable, KBRunCompletion runCompletion) {
    [installable installStatus:^(NSError *error, KBInstallStatus status, NSString *info) {
      KBInstallAction *install = [[KBInstallAction alloc] init];
      install.installable = installable;
      install.error = error;
      install.status = status;
      install.statusInfo = info;
      runCompletion(install);
    }];
  };
  rover.completion = completion;
  [rover run];
}

- (void)install:(NSArray *)installables completion:(KBInstallActions)completion {
  // Ensure application support dir is available
  [AppDelegate applicationSupport:nil create:YES error:nil]; // TODO Handle error

  KBRunOver *rover = [[KBRunOver alloc] init];
  rover.objects = installables;
  rover.runBlock = ^(id<KBInstallable> installable, KBRunCompletion runCompletion) {
    [installable install:^(NSError *error, KBInstallStatus status, NSString *info) {
      KBInstallAction *install = [[KBInstallAction alloc] init];
      install.installable = installable;
      install.error = error;
      install.status = status;
      install.statusInfo = info;
      runCompletion(install);
    }];
  };
  rover.completion = completion;
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
