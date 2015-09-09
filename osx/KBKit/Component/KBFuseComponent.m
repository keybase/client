//
//  KBFuseInstall.m
//  Keybase
//
//  Created by Gabriel on 5/11/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFuseComponent.h"


#import <MPMessagePack/MPXPCClient.h>
#import "KBDebugPropertiesView.h"
#import "KBFS.h"
#import "KBSemVersion.h"

@interface KBFuseComponent ()
@property KBDebugPropertiesView *infoView;
@property KBSemVersion *version;

@property (nonatomic) MPXPCClient *helper;
@end

@implementation KBFuseComponent

- (NSString *)name {
  return @"OSXFuse";
}

- (NSString *)info {
  return @"Extensions for KBFS";
}

- (NSImage *)image {
  return [NSImage imageNamed:@"Fuse.icns"];
}

- (NSView *)componentView {
  [self componentDidUpdate];
  return _infoView;
}

- (void)componentDidUpdate {
  GHODictionary *info = [GHODictionary dictionary];

  info[@"Version"] = KBOr([[self version] description], @"-");
  info[@"Bundle Version"] = self.bundleVersion;

  GHODictionary *statusInfo = [self componentStatusInfo];
  if (statusInfo) [info addEntriesFromOrderedDictionary:statusInfo];

  info[@"Location"] = KBFUSE_BUNDLE;

  if (!_infoView) _infoView = [[KBDebugPropertiesView alloc] init];
  [_infoView setProperties:info];
}

- (KBSemVersion *)bundleVersion {
  return [KBSemVersion version:NSBundle.mainBundle.infoDictionary[@"KBFuseVersion"]];
}

- (void)refreshComponent:(KBCompletion)completion {
  GHODictionary *info = [GHODictionary dictionary];
  KBSemVersion *bundleVersion = self.bundleVersion;
  MPXPCClient *helper = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" privileged:YES];
  helper.timeout = 10;
  [helper sendRequest:@"version" params:nil completion:^(NSError *error, NSDictionary *versions) {
    if (error) {
      self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusUnknown runtimeStatus:KBRuntimeStatusNone info:nil];
      completion(error);
    } else {
      NSString *fuseRunningVersion = KBIfNull(versions[@"fuseRunningVersion"], nil);
      NSString *fuseInstalledVersion = KBIfNull(versions[@"fuseInstalledVersion"], nil);
      KBSemVersion *runningVersion = [KBSemVersion version:fuseRunningVersion];
      KBSemVersion *installedVersion = [KBSemVersion version:fuseInstalledVersion];
      self.version = runningVersion;
      if (runningVersion) info[@"Version"] = [runningVersion description];
      if (!runningVersion) {
        KBInstallStatus installStatus = installedVersion ? KBInstallStatusInstalled : KBInstallStatusNotInstalled;
        self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:installStatus runtimeStatus:KBRuntimeStatusNotRunning info:nil];
        completion(nil);
      } else if ([bundleVersion isGreaterThan:runningVersion]) {
        if (bundleVersion) info[@"Bundle Version"] = [bundleVersion description];
        // TODO Support upgrades for Fuse
        NSString *errorMsg = NSStringWithFormat(@"Upgrade available (%@ > %@) but currently unsupported", [bundleVersion description], [runningVersion description]);
        self.componentStatus = [KBComponentStatus componentStatusWithError:KBMakeError(-1, @"%@", errorMsg)];
        completion(nil);
      } else {
        self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusInstalled runtimeStatus:KBRuntimeStatusRunning info:info];
        completion(nil);
      }
    }
  }];
}

- (MPXPCClient *)helper {
  if (!_helper) _helper = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" privileged:YES];
  return _helper;
}

- (void)install:(KBCompletion)completion {
  [[self helper] sendRequest:@"kbfs_install" params:nil completion:^(NSError *error, id value) {
    completion(error);
  }];
}

- (void)uninstall:(KBCompletion)completion {
  [[self helper] sendRequest:@"kbfs_uninstall" params:nil completion:^(NSError *error, id value) {
    completion(error);
  }];
}

- (void)start:(KBCompletion)completion {
  [[self helper] sendRequest:@"kbfs_load" params:nil completion:^(NSError *error, id value) {
    completion(error);
  }];
}

- (void)stop:(KBCompletion)completion {
  [[self helper] sendRequest:@"kbfs_unload" params:nil completion:^(NSError *error, id value) {
    completion(error);
  }];
}

@end
