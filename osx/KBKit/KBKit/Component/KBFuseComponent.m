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
  [KBTask execute:binPath args:@[@"-d", @"--log-format=plain", @"fuse", @"status", bundleVersionFlag] completion:^(NSError *error, NSData *outData, NSData *errData) {
    if (error) {
      completion(error, nil);
      return;
    }
    if (!outData) {
      completion(KBMakeError(-1, @"No data for fuse status"), nil);
      return;
    }

    id dict = [NSJSONSerialization JSONObjectWithData:outData options:NSJSONReadingMutableContainers error:&error];
    if (error) {
      DDLogError(@"Invalid data: %@", [[NSString alloc] initWithData:outData encoding:NSUTF8StringEncoding]);
      completion(error, nil);
      return;
    }
    if (!dict) {
      completion(KBMakeError(-1, @"Invalid data for fuse status"), nil);
      return;
    }

    KBRFuseStatus *status = [MTLJSONAdapter modelOfClass:KBRFuseStatus.class fromJSONDictionary:dict error:&error];
    completion(nil, status);
  }];
}

- (void)refreshComponent:(KBRefreshComponentCompletion)completion {
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
    completion(self.componentStatus);
  }];
}

- (KBInstallRuntimeStatus)runtimeStatus {
  if (!self.fuseStatus) return KBInstallRuntimeStatusNone;
  return self.fuseStatus.kextStarted ? KBInstallRuntimeStatusStarted : KBInstallRuntimeStatusStopped;
}

- (void)install:(KBCompletion)completion {
  [self refreshComponent:^(KBComponentStatus *cs) {
    // Upgrades currently unsupported for Fuse
    if (cs.installAction == KBRInstallActionUpgrade) {
      DDLogDebug(@"Needs upgrade but not supported yet");
      completion(nil);
      return;
    }

    if ([cs needsInstallOrUpgrade]) {
      [self _install:completion];
    } else {
      completion(nil);
    }
  }];
}

- (void)_install:(KBCompletion)completion {
  [self.helperTool.helper sendRequest:@"kextInstall" params:@[@{@"source": self.source, @"destination": self.destination, @"kextID": self.kextID, @"kextPath": self.kextPath}] completion:^(NSError *error, id value) {
    completion(error);
  }];
}

- (void)uninstall:(KBCompletion)completion {
  [self.helperTool.helper sendRequest:@"kextUninstall" params:@[@{@"destination": self.destination, @"kextID": self.kextID}] completion:^(NSError *error, id value) {
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
