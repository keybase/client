//
//  KBMountDir.m
//  KBKit
//
//  Created by Gabriel on 8/24/16.
//  Copyright © 2016 Gabriel Handford. All rights reserved.
//

#import "KBMountDir.h"

@interface KBMountDir ()
@property KBHelperTool *helperTool;
@property KBEnvConfig *config;
@end

@implementation KBMountDir

@synthesize error;

- (instancetype)initWithConfig:(KBEnvConfig *)config helperTool:(KBHelperTool *)helperTool {
  if ((self = [self initWithConfig:config name:@"Mount Directory" info:@"Location for mount directory" image:nil])) {
    _helperTool = helperTool;
  }
  return self;
}

- (NSString *)name {
  return @"Mount directory";
}

- (BOOL)checkMountDirExists {
  NSString *directory = self.config.mountDir;
  BOOL exists = [NSFileManager.defaultManager fileExistsAtPath:directory isDirectory:nil];
  if (!exists) {
    DDLogDebug(@"Mount directory doesn't exist: %@", directory);
    return NO;
  }

  NSError *err = nil;
  NSDictionary *attributes = [NSFileManager.defaultManager attributesOfItemAtPath:directory error:&err];
  if (!attributes) {
    DDLogDebug(@"Mount directory error: %@", error);
    return NO;
  }

  // The mount dir might have 0700 permissions if left mounted but unattached to KBFS (owned by user).
  // And the dir might have 0600 permissions if unmounted (owned by user).
  // If mounted and attached to KBFS it will have 0755 permissions (owned by root).
  DDLogDebug(@"Mount directory=%@, attributes=%@", directory, attributes);
  return YES;
}

- (void)removeMountDir:(NSString *)mountDir completion:(KBCompletion)completion {
  // Because the mount dir is in the root path, we need the helper tool to remove it, even if owned by the user
  NSDictionary *params = @{@"path": mountDir};
  DDLogDebug(@"Removing mount directory: %@", params);
  [self.helperTool.helper sendRequest:@"remove" params:@[params] completion:^(NSError *err, id value) {
    completion(err);
  }];
}

- (void)createMountDir:(KBCompletion)completion {
  uid_t uid = getuid();
  gid_t gid = getgid();
  NSNumber *permissions = [NSNumber numberWithShort:0600];
  NSDictionary *params = @{@"directory": self.config.mountDir, @"uid": @(uid), @"gid": @(gid), @"permissions": permissions, @"excludeFromBackup": @(YES)};
  DDLogDebug(@"Creating mount directory: %@", params);
  [self.helperTool.helper sendRequest:@"createDirectory" params:@[params] completion:^(NSError *err, id value) {
    completion(err);
  }];
}

- (NSError *)statusError {
  return nil;
}

- (void)install:(KBCompletion)completion {
  if (![self checkMountDirExists]) {
    [self createMountDir:^(NSError *err) {
      if (err) {
        completion(err);
        return;
      }
      // Run check again after create for debug info
      [self checkMountDirExists];
      completion(nil);
    }];
  } else {
    completion(nil);
  }
}

- (void)uninstall:(KBCompletion)completion {
  NSString *mountDir = self.config.mountDir;
  if (![NSFileManager.defaultManager fileExistsAtPath:mountDir isDirectory:nil]) {
    DDLogInfo(@"The mount directory doesn't exist: %@", mountDir);
    completion(nil);
    return;
  }
  [self removeMountDir:mountDir completion:completion];
}

@end
