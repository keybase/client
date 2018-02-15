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
      [self addFinderFavorite];
      completion(nil);
    }];
  } else {
    [self addFinderFavorite];
    completion(nil);
  }
}

- (void)uninstall:(KBCompletion)completion {
  NSString *mountDir = self.config.mountDir;
  if ([NSFileManager.defaultManager fileExistsAtPath:mountDir isDirectory:nil]) {
    [self removeMountDir:mountDir completion:completion];
  } else {
    DDLogInfo(@"The mount directory doesn't exist: %@", mountDir);
  }
  [self removeFinderFavorite];
  completion(nil);
}

- (void)refreshComponent:(KBRefreshComponentCompletion)completion {
  if ([self checkMountDirExists]) {
    self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusInstalled installAction:KBRInstallActionNone info:nil error:nil];
  } else {
    self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusNotInstalled installAction:KBRInstallActionInstall info:nil error:nil];
  }
  completion(self.componentStatus);
}

- (void)addFinderFavorite {
  // Don't add if disabled
  NSString *finderDisabledPath = [self.config dataPath:@"finder_disabled.config" options:0];
  if ([[NSFileManager defaultManager] fileExistsAtPath:finderDisabledPath]) return;

  // Don't add for 10.10 or below because of Finder bugs
  NSOperatingSystemVersion version = [[NSProcessInfo processInfo] operatingSystemVersion];
  if (version.majorVersion == 10 && version.minorVersion < 11) {
    return;
  }

  NSInteger position = [self finderConfigPosition];
  DDLogDebug(@"Read finder favorite position: %@", @(position));
  [self setFinderFavoriteEnabled:YES position:position];
}

- (void)removeFinderFavorite {
  [self saveFinderConfig];
  [self setFinderFavoriteEnabled:NO position:0];
}

- (NSInteger)finderConfigPosition {
  NSString *finderConfigPath = [self.config dataPath:@"finder_position.config" options:0];
  NSString *positionStr = [NSString stringWithContentsOfFile:finderConfigPath encoding:NSUTF8StringEncoding error:nil];
  if (!positionStr) return 0;
  return [positionStr integerValue];
}

- (void)saveFinderConfig {
  NSString *symPath = [self.config dataPath:@"Keybase" options:0];
  NSURL *URL = [NSURL fileURLWithPath:symPath];
  NSInteger position = [KBSharedFileList firstPositionForURL:URL type:kLSSharedFileListFavoriteItems];
  NSString *finderConfigPath = [self.config dataPath:@"finder_position.config" options:0];
  DDLogDebug(@"Saving finder favorite position %@ to %@", @(position), finderConfigPath);
  if (![[NSFileManager defaultManager] createFileAtPath:finderConfigPath contents:[NSStringWithFormat(@"%@", @(position)) dataUsingEncoding:NSUTF8StringEncoding] attributes:nil]) {
    DDLogError(@"Unable to save %@", finderConfigPath);
  }
}

- (BOOL)setFinderFavoriteEnabled:(BOOL)favoritedEnabled position:(NSInteger)position {
  NSError *fileListError = nil;
  [KBMountDir setFileListFavoriteEnabled:favoritedEnabled position:position config:self.config error:&fileListError];
  if (fileListError) {
    DDLogError(@"Error setting file list favorite: %@", fileListError);
    return NO;
  }
  return YES;
}

+ (BOOL)setFileListFavoriteEnabled:(BOOL)fileListFavoriteEnabled position:(NSInteger)position config:(KBEnvConfig *)config error:(NSError **)error {
  if (!config.mountDir) {
    if (error) *error = KBMakeError(0, @"No mount dir");
    return NO;
  }

  // We can't reliably create a file list (Finder) favorite directly for /keybase, since it is a remote volume mount,
  // and there is some funkiness there (like the URL property not resolving, or the display name being ignored).
  // If we create a symlink though, all these problems are avoided. So we'll create a symlink to /keybase and add this
  // as the file list favorite item.
  NSString *symPath = [config dataPath:@"Keybase" options:0];
  if (![[NSFileManager defaultManager] fileExistsAtPath:symPath]) {
    if ([[NSFileManager defaultManager] createSymbolicLinkAtPath:symPath withDestinationPath:config.mountDir error:error]) {
      return NO;
    }
  }

  NSURL *URL = [NSURL fileURLWithPath:symPath];
  NSString *name = [config appName];
  //DDLogDebug(@"File list favorite items: %@", [KBSharedFileList debugItemsForType:kLSSharedFileListFavoriteItems]);
  DDLogDebug(@"File list favorite %@ (%@)", (fileListFavoriteEnabled ? @"enabled" : @"disabled"), URL);
  BOOL changed = [KBSharedFileList setEnabled:fileListFavoriteEnabled URL:URL name:name type:kLSSharedFileListFavoriteItems position:position error:error];
  DDLogDebug(@"File list favorites changed: %@", changed ? @"Yes" : @"No");
  if (error) {
    return NO;
  }
  return changed;
}

@end
