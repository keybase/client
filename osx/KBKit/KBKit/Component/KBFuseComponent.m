//
//  KBFuseInstall.m
//  Keybase
//
//  Created by Gabriel on 5/11/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFuseComponent.h"

#import "KBDebugPropertiesView.h"
#import "KBSemVersion.h"
#import "KBFormatter.h"
#import "KBDefines.h"
#include <sys/mount.h>

@interface KBFuseComponent ()
@property KBDebugPropertiesView *infoView;
@property KBSemVersion *version;
@property KBHelperTool *helperTool;
@property KBRFuseStatus *fuseStatus;
@property NSString *servicePath;
@end

@implementation KBFuseStatus
@end

typedef void (^KBOnFuseStatus)(NSError *error, KBFuseStatus *fuseStatus);

@implementation KBFuseComponent

- (instancetype)initWithConfig:(KBEnvConfig *)config helperTool:(KBHelperTool *)helperTool servicePath:(NSString *)servicePath {
  if ((self = [self initWithConfig:config name:@"Fuse" info:@"Extensions for KBFS" image:[NSImage imageNamed:@"Fuse.icns"]])) {
    _servicePath = servicePath;
    _helperTool = helperTool;
  }
  return self;
}

- (NSView *)componentView {
  [self componentDidUpdate];
  return _infoView;
}

- (void)componentDidUpdate {
  GHODictionary *info = [GHODictionary dictionary];
  GHODictionary *statusInfo = [self.componentStatus statusInfo];
  if (statusInfo) [info addEntriesFromOrderedDictionary:statusInfo];
  if (!_infoView) _infoView = [[KBDebugPropertiesView alloc] init];
  [_infoView setProperties:info];
}

- (void)bundleVersion:(KBSemVersion *)bundleVersion completion:(KBOnFuseStatus)completion {
  KBFuseStatus *status = [[KBFuseStatus alloc] init];
  status.bundleVersion = [bundleVersion description];
  status.hasMounts = [self hasMounts];

  BOOL isDirectory = NO;
  if (![[NSFileManager defaultManager] fileExistsAtPath:self.destination isDirectory:&isDirectory] || !isDirectory) {
    DDLogInfo(@"Fuse destination doesn't exist");
    status.installStatus = KBRInstallStatusNotInstalled;
    status.installAction = KBRInstallActionInstall;
    completion(nil, status);
    return;
  }

  status.installStatus = KBRInstallStatusInstalled;

  NSDictionary *info = [NSDictionary dictionaryWithContentsOfFile:[self.destination stringByAppendingPathComponent:@"Contents/Info.plist"]];
  if (!info) {
    DDLogInfo(@"Couldn't fuse load version");
    status.installStatus = KBRInstallStatusError;
    status.installAction = KBRInstallActionReinstall;
    completion(nil, status);
    return;
  }

  DDLogDebug(@"Fuse version: %@", info[@"CFBundleVersion"]);
  status.version = info[@"CFBundleVersion"];
  if ([bundleVersion isGreaterThan:[KBSemVersion version:status.version]]) {
    DDLogInfo(@"Fuse needs upgrade");
    status.installAction = KBRInstallActionUpgrade;
    completion(nil, status);
    return;
  }

  status.installAction = KBRInstallActionNone;

  completion(nil, status);
}

- (void)refreshComponent:(KBRefreshComponentCompletion)completion {
  [self refreshFuseComponent:^(KBFuseStatus *fuseStatus, KBComponentStatus *componentStatus) {
    completion(componentStatus);
  }];
}

- (BOOL)hasMounts {
  struct statfs *mntbufp;
  DDLogInfo(@"Checking mounts...");
  int mountCount = getmntinfo(&mntbufp, MNT_WAIT);
  BOOL hasMounts = NO;
  for(int i = 0; i < mountCount; i++) {
    NSString *fsType = [NSString stringWithCString:mntbufp[i].f_fstypename encoding:NSASCIIStringEncoding];
    NSString *directory = [NSString stringWithCString:mntbufp[i].f_mntonname encoding:NSASCIIStringEncoding];
    if ([fsType isEqualToString:@"kbfuse"]) {
      DDLogInfo(@"Mount: %@ (%@)", directory, fsType);
      hasMounts = YES;
    }
  }
  return hasMounts;
}

- (void)refreshFuseComponent:(void (^)(KBFuseStatus *fuseStatus, KBComponentStatus *componentStatus))completion {
  KBSemVersion *bundleVersion = [KBSemVersion version:NSBundle.mainBundle.infoDictionary[@"KBFuseVersion"]];
  [self bundleVersion:bundleVersion completion:^(NSError *error, KBFuseStatus *fuseStatus) {
    self.fuseStatus = fuseStatus;
    if (error) {
      self.componentStatus = [KBComponentStatus componentStatusWithError:error];
    } else {

      GHODictionary *info = [GHODictionary dictionary];

      info[@"Version"] = KBIfBlank(fuseStatus.version, nil);

      if (![fuseStatus.version isEqualToString:fuseStatus.bundleVersion]) {
        info[@"Bundle Version"] = KBIfBlank(fuseStatus.bundleVersion, nil);
      }

      KBComponentStatus *componentStatus = [KBComponentStatus componentStatusWithInstallStatus:fuseStatus.installStatus installAction:fuseStatus.installAction info:info error:error];
      self.componentStatus = componentStatus;
    }

    [self componentDidUpdate];
    completion(self.fuseStatus, self.componentStatus);
  }];
}

- (KBInstallRuntimeStatus)runtimeStatus {
  if (!self.fuseStatus) return KBInstallRuntimeStatusNone;
  return self.fuseStatus.kextStarted ? KBInstallRuntimeStatusStarted : KBInstallRuntimeStatusStopped;
}

- (void)install:(KBCompletion)completion {
  [self refreshFuseComponent:^(KBFuseStatus *fuseStatus, KBComponentStatus *cs) {
    // Upgrades currently unsupported for Fuse if there are mounts
    if (cs.installAction == KBRInstallActionUpgrade && fuseStatus.hasMounts) {
      DDLogError(@"Fuse needs upgrade but not supported yet if mounts are present");
      completion(nil);
      return;
    }

    if ([cs needsInstallOrUpgrade]) {
      [self _install:completion];
    } else {
      // Check if we need to fix the current install
      if ([self needsFix]) {
        DDLogInfo(@"Current install needs fix");
        [self fix:completion];
        return;
      }

      DDLogInfo(@"Fuse install is OK");
      completion(nil);
    }
  }];
}

- (void)_install:(KBCompletion)completion {
  NSDictionary *params = @{@"source": self.source, @"destination": self.destination, @"kextID": self.kextID, @"kextPath": self.kextPath};
  DDLogDebug(@"Helper: kextInstall(%@)", params);
  [self.helperTool.helper sendRequest:@"kextInstall" params:@[params] completion:^(NSError *error, id value) {
    completion(error);
  }];
}

- (void)uninstall:(KBCompletion)completion {
  NSDictionary *params = @{@"destination": self.destination, @"kextID": self.kextID};
  DDLogDebug(@"Helper: kextUninstall(%@)", params);
  [self.helperTool.helper sendRequest:@"kextUninstall" params:@[params] completion:^(NSError *error, id value) {
    completion(error);
  }];
}

- (void)start:(KBCompletion)completion {
  [self.helperTool.helper sendRequest:@"kextLoad" params:@[@{@"kextID": self.kextID, @"kextPath": self.kextPath}] completion:^(NSError *error, id value) {
    completion(error);
  }];
}

- (void)stop:(KBCompletion)completion {
  [self.helperTool.helper sendRequest:@"kextUnload" params:@[@{@"kextID": self.kextID}] completion:^(NSError *error, id value) {
    completion(error);
  }];
}

// Check if we need to do a fix instead of a full install
- (BOOL)needsFix {
  return [self missingSymlink] || [self invalidLoadPermissions];
}

- (BOOL)missingSymlink {
  // Check if missing 10.11 symlink in extensions directory
  return [NSFileManager.defaultManager fileExistsAtPath:self.destination] && ![NSFileManager.defaultManager attributesOfItemAtPath:[self.destination stringByAppendingPathComponent:@"Contents/Extensions/10.11"] error:nil];
}

- (BOOL)invalidLoadPermissions {
  // A user reported an issue and the cause was invalid permissions on load script. This double checks the permissions.
  NSString *path = [NSString stringWithFormat:@"%@/Contents/Resources/load_kbfuse", self.destination];
  NSDictionary *fileAttributes = [NSFileManager.defaultManager attributesOfItemAtPath:path error:nil];
  if (!fileAttributes) return YES;
  NSNumber *loadPermissions = fileAttributes[NSFilePosixPermissions];
  DDLogDebug(@"Load permissions: %o", [loadPermissions shortValue]);
  return ![loadPermissions isEqual:[NSNumber numberWithShort:04755]];
}

- (void)fix:(KBCompletion)completion {
  // Current fix is to re-copy the fuse kext
  NSDictionary *params = @{@"source": self.source, @"destination": self.destination};
  DDLogDebug(@"Helper: kextCopy(%@)", params);
  [self.helperTool.helper sendRequest:@"kextCopy" params:@[params] completion:^(NSError *error, id value) {
    completion(error);
  }];
}

- (NSString *)source {
  return [NSBundle.mainBundle.resourcePath stringByAppendingPathComponent:@"kbfuse.bundle"];
}

- (NSString *)destination {
  return @"/Library/Filesystems/kbfuse.fs";
}

- (NSString *)kextID {
  return @"com.github.kbfuse.filesystems.kbfuse";
}

- (NSString *)kextPath {
  return @"/Library/Filesystems/kbfuse.fs/Contents/Extensions/10.10/kbfuse.kext";
}

@end
