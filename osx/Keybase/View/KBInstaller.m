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
#import "KBLaunchCtl.h"

@interface KBInstaller ()
@property KBLaunchCtl *launchCtl;
@end

@implementation KBInstaller

- (instancetype)init {
  if ((self = [super init])) {
    _launchCtl = [[KBLaunchCtl alloc] init];
    _launchCtl.releaseOnly = YES;
  }
  return self;
}

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
    NSError *error = nil;
    [AppDelegate applicationSupport:nil create:YES error:&error]; // Create application support dir
    if (error) {
      completion(error, NO, KBInstallTypeNone);
      return;
    }

    [_launchCtl installLaunchAgent:^(NSError *error) {
      if (error) {
        completion(error, NO, KBInstallTypeNone);
        return;
      }
      completion(error, YES, KBInstallTypeInstaller);
    }];
  }
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
    GHDebug(@"Task %@ exited with status: %@", t, @(t.terminationStatus));
  };
  [task launch];
}

@end
