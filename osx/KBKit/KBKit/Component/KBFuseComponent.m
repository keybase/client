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

#import <IOKit/kext/KextManager.h>

@interface KBFuseComponent ()
@property KBDebugPropertiesView *infoView;
@property KBSemVersion *version;
@property KBHelperTool *helperTool;
@property KBRFuseStatus *fuseStatus;
@end

typedef void (^KBOnFuseStatus)(NSError *error, KBRFuseStatus *fuseStatus);

@implementation KBFuseComponent

- (instancetype)initWithConfig:(KBEnvConfig *)config helperTool:(KBHelperTool *)helperTool {
  if ((self = [self initWithConfig:config name:@"Fuse" info:@"Extensions for KBFS" image:[NSImage imageNamed:@"Fuse.icns"]])) {
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
  [KBTask execute:binPath args:@[@"fuse", @"status", bundleVersionFlag] completion:^(NSError *error, NSData *outData, NSData *errData) {
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

- (void)refreshComponent:(KBCompletion)completion {
  KBSemVersion *bundleVersion = [KBSemVersion version:NSBundle.mainBundle.infoDictionary[@"KBFuseVersion"]];
  [KBFuseComponent status:[self.config serviceBinPathWithPathOptions:0 useBundle:YES] bundleVersion:bundleVersion completion:^(NSError *error, KBRFuseStatus *fuseStatus) {

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

    self.fuseStatus = fuseStatus;
    self.componentStatus = componentStatus;

    [self componentDidUpdate];
    completion(nil);
  }];
}

- (KBInstallRuntimeStatus)runtimeStatus {
  if (!self.fuseStatus) return KBInstallRuntimeStatusNone;
  return self.fuseStatus.kextStarted ? KBInstallRuntimeStatusStarted : KBInstallRuntimeStatusStopped;
}

- (void)install:(KBCompletion)completion {
  [self refreshComponent:^(NSError *error) {
    if (self.componentStatus && [self.componentStatus needsInstallOrUpgrade]) {
      [self _install:completion];
    } else {
      completion(nil);
    }
  }];
}

- (void)_install:(KBCompletion)completion {
  [self.helperTool.helper sendRequest:@"kext_install" params:@[@{@"source": self.source, @"destination": self.destination, @"kextID": self.kextID, @"kextPath": self.kextPath}] completion:^(NSError *error, id value) {
    completion(error);
  }];
}

- (void)uninstall:(KBCompletion)completion {
  [self.helperTool.helper sendRequest:@"kext_uninstall" params:@[@{@"destination": self.destination, @"kextID": self.kextID}] completion:^(NSError *error, id value) {
    completion(error);
  }];
}

- (void)start:(KBCompletion)completion {
  [self.helperTool.helper sendRequest:@"kext_load" params:@[@{@"kextID": self.kextID, @"kextPath": self.kextPath}] completion:^(NSError *error, id value) {
    completion(error);
  }];
}

- (void)stop:(KBCompletion)completion {
  [self.helperTool.helper sendRequest:@"kext_unload" params:@[@{@"kextID": self.kextID}] completion:^(NSError *error, id value) {
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
