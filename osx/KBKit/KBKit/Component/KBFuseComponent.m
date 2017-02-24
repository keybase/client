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
#import "KBTask.h"
#import "KBDefines.h"

@interface KBFuseComponent ()
@property KBDebugPropertiesView *infoView;
@property KBSemVersion *version;
@property KBHelperTool *helperTool;
@property KBRFuseStatus *fuseStatus;
@property NSString *servicePath;
@end

typedef void (^KBOnFuseStatus)(NSError *error, KBRFuseStatus *fuseStatus);

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

+ (void)status:(NSString *)binPath bundleVersion:(KBSemVersion *)bundleVersion completion:(KBOnFuseStatus)completion {
  NSString *bundleVersionFlag = NSStringWithFormat(@"--bundle-version=%@", [bundleVersion description]);
  [KBTask execute:binPath args:@[@"-d", @"--log-format=file", @"fuse", @"status", bundleVersionFlag] timeout:KBDefaultTaskTimeout completion:^(NSError *error, NSData *outData, NSData *errData) {
    if (error) {
      completion(error, nil);
      return;
    }
    if (!outData) {
      completion(KBMakeError(KBErrorCodeGeneric, @"No data for fuse status"), nil);
      return;
    }

    id dict = [NSJSONSerialization JSONObjectWithData:outData options:NSJSONReadingMutableContainers error:&error];
    if (error) {
      DDLogError(@"Invalid data: %@", [[NSString alloc] initWithData:outData encoding:NSUTF8StringEncoding]);
      completion(error, nil);
      return;
    }
    if (!dict) {
      completion(KBMakeError(KBErrorCodeGeneric, @"Invalid data for fuse status"), nil);
      return;
    }

    KBRFuseStatus *status = [MTLJSONAdapter modelOfClass:KBRFuseStatus.class fromJSONDictionary:dict error:&error];
    completion(nil, status);
  }];
}

- (void)refreshComponent:(KBRefreshComponentCompletion)completion {
  [self refreshFuseComponent:^(KBRFuseStatus *fuseStatus, KBComponentStatus *componentStatus) {
    completion(componentStatus);
  }];
}

- (void)refreshFuseComponent:(void (^)(KBRFuseStatus *fuseStatus, KBComponentStatus *componentStatus))completion {
  KBSemVersion *bundleVersion = [KBSemVersion version:NSBundle.mainBundle.infoDictionary[@"KBFuseVersion"]];
  [KBFuseComponent status:[self.config serviceBinPathWithPathOptions:0 servicePath:self.servicePath] bundleVersion:bundleVersion completion:^(NSError *error, KBRFuseStatus *fuseStatus) {

    self.fuseStatus = fuseStatus;
    if (error) {
      self.componentStatus = [KBComponentStatus componentStatusWithError:error];
    } else {

      GHODictionary *info = [GHODictionary dictionary];
      info[@"Version"] = KBIfBlank(fuseStatus.version, nil);

      if (![fuseStatus.version isEqualToString:fuseStatus.bundleVersion]) {
        info[@"Bundle Version"] = KBIfBlank(fuseStatus.bundleVersion, nil);
      }

      if (![NSString gh_isBlank:fuseStatus.kextID]) {
        info[@"Kext ID"] = KBIfBlank(fuseStatus.kextID, nil);
        info[@"Kext Loaded"] = fuseStatus.kextStarted ? @"Yes" : @"No";
      }
      info[@"Path"] = KBIfBlank(fuseStatus.path, nil);

      if (fuseStatus.status.code > 0) {
        error = KBMakeError(fuseStatus.status.code, @"%@", fuseStatus.status.desc);
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

- (BOOL)hasKBFuseMounts:(KBRFuseStatus *)fuseStatus {
  for (KBRFuseMountInfo *mountInfo in fuseStatus.mountInfos) {
    if ([mountInfo.fstype isEqualToString:@"kbfuse"]) {
      return YES;
    }
  }
  return NO;
}

- (void)install:(KBCompletion)completion {
  [self _install:^(NSError *error) {
    if (error) {
      completion(error);
      return;
    }
    DDLogInfo(@"Loading kext");
    [self loadKext:^(NSError *error) {
      if (error.code == -1000) { // KBHelperErrorKext
        completion([NSError errorWithDomain:@"Keybase" code:-1 userInfo:
                    @{NSLocalizedDescriptionKey: @"We were unable to load KBFS.",
                      NSLocalizedRecoveryOptionsErrorKey: @[@"OK"],
                      NSLocalizedRecoverySuggestionErrorKey: @"This may be due to a limitation in MacOS where there aren't any device slots available. Device slots can be taken up by apps such as VMWare, VirtualBox, anti-virus programs, VPN programs and Intel HAXM.",
                      NSURLErrorKey: [NSURL URLWithString:@"https://github.com/keybase/client/wiki/Troubleshooting#unable-to-load-kbfs-fuse-kext-cant-load"],
                      }]);
        return;
      }
      completion(error);
    }];
  }];
}

- (void)_install:(KBCompletion)completion {
  [self refreshFuseComponent:^(KBRFuseStatus *fuseStatus, KBComponentStatus *cs) {
    // Upgrades currently unsupported for Fuse if there are mounts
    if (cs.installAction == KBRInstallActionUpgrade && [self hasKBFuseMounts:fuseStatus]) {
      DDLogError(@"Fuse needs upgrade but not supported yet if mounts are present");
      completion(nil);
      return;
    }

    if ([cs needsInstallOrUpgrade]) {
      [self _installKext:completion];
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

- (void)_installKext:(KBCompletion)completion {
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

- (void)loadKext:(KBCompletion)completion {
  [self.helperTool.helper sendRequest:@"kextLoad" params:@[@{@"kextID": self.kextID, @"kextPath": self.kextPath}] completion:^(NSError *error, id value) {
    completion(error);
  }];
}

- (void)start:(KBCompletion)completion {
  [self loadKext:completion];
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
