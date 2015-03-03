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

#define PLIST_PATH (@"keybase.keybased.plist")

@implementation KBInstaller

- (void)checkInstall:(void (^)(NSError *error, BOOL installed, KBInstallType installType))completion {
//  KBRPClient *checkClient = [[KBRPClient alloc] init];
//  [checkClient openAndCheck:^(NSError *error) {
//    if (error) {
//      // There was an error (hopefully because keybased isn't installed)
//      // so lets try to install.
//      [self install:completion];
//      return;
//    }
//
//    // Its running ok
//    completion(nil);
//  }];

  [self install:completion];
}

- (void)install:(void (^)(NSError *error, BOOL installed, KBInstallType installType))completion {
  NSString *brewCheck = @"/usr/local/bin/keybased"; // Symlink to brew Cellar
  if ([NSFileManager.defaultManager fileExistsAtPath:brewCheck]) {
    // Don't install (it's installed by homebrew)
    completion(nil, NO, KBInstallTypeHomebrew);
  } else {
    GHWeakSelf gself = self;
    NSError *error = nil;
    [AppDelegate applicationSupport:nil create:YES error:&error]; // Create application support dir
    if (error) {
      completion(error, NO, KBInstallTypeNone);
      return;
    }

    [gself installLaunchAgent:completion];
  }
}

- (void)installLaunchAgent:(void (^)(NSError *error, BOOL installed, KBInstallType installType))completion {
  // Install launch agent (if not installed)
  NSString *launchAgentDir = [[NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES) firstObject] stringByAppendingPathComponent:@"LaunchAgents"];

  if (!launchAgentDir) {
    NSError *error = KBMakeErrorWithRecovery(-1, @"Install Error", @"No launch agent directory.", nil);
    completion(error, NO, KBInstallTypeNone);
    return;
  }

  NSString *launchAgentPlistDest = [launchAgentDir stringByAppendingPathComponent:PLIST_PATH];

  //
  // TODO
  // Only install if not exists or upgrade. We are currently always installing/updating the plist.
  //
  //if (![NSFileManager.defaultManager fileExistsAtPath:launchAgentPlistDest]) {
  NSString *launchAgentPlistSource = [[NSBundle mainBundle] pathForResource:PLIST_PATH.stringByDeletingPathExtension ofType:PLIST_PATH.pathExtension];

  if (!launchAgentPlistSource) {
    NSError *error = KBMakeErrorWithRecovery(-1, @"Install Error", @"No launch agent plist found in bundle.", nil);
    completion(error, NO, KBInstallTypeNone);
    return;
  }

  NSError *error = nil;

  // Remove if exists
  if ([NSFileManager.defaultManager fileExistsAtPath:launchAgentPlistDest]) {
    if (![NSFileManager.defaultManager removeItemAtPath:launchAgentPlistDest error:&error]) {
      if (!error) error = KBMakeErrorWithRecovery(-1, @"Install Error", @"Unable to remove existing luanch agent plist for upgrade.", nil);
      completion(error, NO, KBInstallTypeNone);
      return;
    }
  }

  if (![NSFileManager.defaultManager copyItemAtPath:launchAgentPlistSource toPath:launchAgentPlistDest error:&error]) {
    if (!error) error = KBMakeErrorWithRecovery(-1, @"Install Error", @"Unable to transfer launch agent plist.", nil);
    completion(error, NO, KBInstallTypeNone);
    return;
  }

  // We installed the launch agent plist
  GHDebug(@"Installed");

  [self checkLaunch:launchAgentPlistDest completion:^(NSError *error) {
    if (error) {
      completion(error, NO, KBInstallTypeNone);
      return;
    }
    completion(nil, YES, KBInstallTypeInstaller);
  }];

  [self installDebugMocks];

//  } else {
//    // Already installed
//    completion(nil, NO, KBInstallTypeInstaller);
//  }
}

- (void)checkLaunch:(NSString *)path completion:(void (^)(NSError *error))completion {
  NSTask *task = [[NSTask alloc] init];
  task.launchPath = @"/bin/launchctl";
  task.arguments = @[@"load", path];
  task.terminationHandler = ^(NSTask *t) {
    GHDebug(@"Task (launchctl) %@ exited with status: %@", t, @(t.terminationStatus));
  };
  // Only do this for release versions
#ifndef DEBUG
  [task launch];
#endif
  completion(nil);
}

//- (void)checkLaunch:(void (^)(NSError *error))completion {
//  launch_data_t config = launch_data_alloc(LAUNCH_DATA_DICTIONARY);
//
//  launch_data_t val;
//  val = launch_data_new_string("keybase.keybased");
//  launch_data_dict_insert(config, val, LAUNCH_JOBKEY_LABEL);
//  val = launch_data_new_string("/Applications/Keybase.app/Contents/MacOS/keybased");
//  launch_data_dict_insert(config, val, LAUNCH_JOBKEY_PROGRAM);
//  val = launch_data_new_bool(YES);
//  launch_data_dict_insert(config, val, LAUNCH_JOBKEY_KEEPALIVE);
//
//  launch_data_t msg = launch_data_alloc(LAUNCH_DATA_DICTIONARY);
//  launch_data_dict_insert(msg, config, LAUNCH_KEY_SUBMITJOB);
//
//  launch_data_t response = launch_msg(msg);
//  if (!response) {
//    NSError *error = KBMakeErrorWithRecovery(-1, @"Launchd Error", @"Unable to launch keybased agent.", nil);
//    completion(error);
//  } else if (response && launch_data_get_type(response) == LAUNCH_DATA_ERRNO) {
//    //strerror(launch_data_get_errno(response))
//    //NSError *error = KBMakeErrorWithRecovery(-1, @"Launchd Error", @"Unable to launch keybased agent (LAUNCH_DATA_ERRNO).", nil);
//    //completion(error);
//    completion(nil);
//  } else {
//    completion(nil);
//  }
//}

- (void)removeDirectory:(NSString *)directory error:(NSError **)error {
  NSArray *files = [NSFileManager.defaultManager contentsOfDirectoryAtPath:directory error:error];
  for (NSString *file in files) {
    [NSFileManager.defaultManager removeItemAtPath:[directory stringByAppendingPathComponent:file] error:error];
  }
  [NSFileManager.defaultManager removeItemAtPath:directory error:error];
}

- (void)installDebugMocks {
  // TODO: Remove from release
  NSString *recordZip = [[NSBundle mainBundle] pathForResource:@"record" ofType:@"zip"];
  NSString *recordDir = [AppDelegate applicationSupport:@[@"Record"] create:NO error:nil];
  [self removeDirectory:recordDir error:nil];
  [NSFileManager.defaultManager createDirectoryAtPath:recordDir withIntermediateDirectories:YES attributes:nil error:nil];
  NSTask *task = [[NSTask alloc] init];
  task.currentDirectoryPath = recordDir;
  task.launchPath = @"/usr/bin/unzip";
  task.arguments = @[recordZip];
  task.standardOutput = nil;
  task.standardError = nil;
  task.terminationHandler = ^(NSTask *t) {
    GHDebug(@"Task %@ exited with status: %@", t, @(t.terminationStatus));
  };
  [task launch];
}

@end
