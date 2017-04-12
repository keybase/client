//
//  KBMountDir.m
//  KBKit
//
//  Created by Gabriel on 8/24/16.
//  Copyright © 2016 Gabriel Handford. All rights reserved.
//

#import "KBMountDir.h"
#import "KBInstaller.h"
#import "KBSharedFileList.h"

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

- (void)install:(KBCompletion)completion {
  if (![self checkMountDirExists]) {
    [self createMountDir:^(NSError *err) {
      if (err) {
        completion(err);
        return;
      }
      // Run check again after create for debug info
      [self checkMountDirExists];

      // Enabled Finder favorite
      [self setFinderFavoriteEnabled:YES];
      completion(nil);
    }];
  } else {
    [self setFinderFavoriteEnabled:YES];
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
  [self setFinderFavoriteEnabled:NO];
}

- (void)refreshComponent:(KBRefreshComponentCompletion)completion {
  if ([self checkMountDirExists]) {
    self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusInstalled installAction:KBRInstallActionNone info:nil error:nil];
  } else {
    self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusNotInstalled installAction:KBRInstallActionInstall info:nil error:nil];
  }
  completion(self.componentStatus);
}

- (BOOL)setFinderFavoriteEnabled:(BOOL)favoritedEnabled {
  NSError *error = nil;
  [KBMountDir setFileListFavoriteEnabled:favoritedEnabled config:self.config error:&error];
  if (error) {
    DDLogError(@"Error setting file list favorite: %@", error);
    return NO;
  }
  return YES;
}

+ (BOOL)setFileListFavoriteEnabled:(BOOL)fileListFavoriteEnabled config:(KBEnvConfig *)config error:(NSError **)error {
  if (!config.mountDir) {
    if (error) *error = KBMakeError(0, @"No mount dir");
    return NO;
  }

  // We can't reliably create a file list (Finder) favorite directly for /keybase, since it is a remote volume mount,
  // and there is some funkiness there (like the URL property not resolving, or the display name being ignored).
  // If we create a symlink though, all these problems are avoided. So we'll create a symlink to /keybase and add this
  // as the file list favorite item.
  NSString *symPath = [config appPath:@"Keybase" options:0];
  if (![[NSFileManager defaultManager] fileExistsAtPath:symPath]) {
    if ([[NSFileManager defaultManager] createSymbolicLinkAtPath:symPath withDestinationPath:config.mountDir error:error]) {
      return NO;
    }
  }

  NSURL *URL = [NSURL fileURLWithPath:symPath];
  NSString *name = [config appName];
  //DDLogDebug(@"File list favorite items: %@", [KBSharedFileList debugItemsForType:kLSSharedFileListFavoriteItems]);
  DDLogDebug(@"File list favorite %@ (%@)", (fileListFavoriteEnabled ? @"enabled" : @"disabled"), URL);
  BOOL changed = [KBSharedFileList setEnabled:fileListFavoriteEnabled URL:URL name:name type:kLSSharedFileListFavoriteItems insertAfter:kLSSharedFileListItemBeforeFirst error:&error];
  DDLogDebug(@"File list favorites changed: %@", changed ? @"Yes" : @"No");
  if (error) {
    return NO;
  }
  return changed;
}

@end
