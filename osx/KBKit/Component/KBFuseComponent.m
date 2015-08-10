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

@interface KBFuseComponent ()
@property KBDebugPropertiesView *infoView;
@property NSString *version;
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

  info[@"Version"] = KBOr([self version], @"-");
  info[@"Bundle Version"] = self.bundleVersion;

  GHODictionary *statusInfo = [self componentStatusInfo];
  if (statusInfo) [info addEntriesFromOrderedDictionary:statusInfo];

  info[@"Location"] = KBFUSE_BUNDLE;

  if (!_infoView) _infoView = [[KBDebugPropertiesView alloc] init];
  [_infoView setProperties:info];
}

- (NSString *)bundleVersion {
  return [[NSBundle mainBundle] infoDictionary][@"KBFuseVersion"];
}

- (void)refreshComponent:(KBCompletion)completion {
  GHODictionary *info = [GHODictionary dictionary];
  NSString *bundleVersion = self.bundleVersion;
  MPXPCClient *helper = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" privileged:YES];
  [helper sendRequest:@"version" params:nil completion:^(NSError *error, NSDictionary *versions) {
    if (error) {
      self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusNotInstalled runtimeStatus:KBRuntimeStatusNotRunning info:nil];
      completion(error);
    } else {
      NSString *runningVersion = KBIfNull(versions[@"fuseRunningVersion"], nil);
      NSString *installedVersion = KBIfNull(versions[@"fuseInstalledVersion"], nil);
      self.version = runningVersion;
      if (runningVersion) info[@"Version"] = runningVersion;
      if (!runningVersion) {
        KBInstallStatus installStatus = installedVersion ? KBInstallStatusInstalled : KBInstallStatusNotInstalled;
        self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:installStatus runtimeStatus:KBRuntimeStatusNotRunning info:nil];
        completion(nil);
      } else if ([runningVersion isEqualTo:bundleVersion]) {
        self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusInstalled runtimeStatus:KBRuntimeStatusRunning info:info];
        completion(nil);
      } else {
        if (bundleVersion) info[@"Bundle Version"] = bundleVersion;
        self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusNeedsUpgrade runtimeStatus:KBRuntimeStatusRunning info:info];
        completion(nil);
      }
    }
  }];
}

- (void)install:(KBCompletion)completion {
  MPXPCClient *helper = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" privileged:YES];
  [helper sendRequest:@"kbfs_install" params:nil completion:^(NSError *error, id value) {
    completion(error);
  }];
}

- (void)uninstall:(KBCompletion)completion {
  MPXPCClient *helper = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" privileged:YES];
  [helper sendRequest:@"kbfs_uninstall" params:nil completion:^(NSError *error, id value) {
    completion(error);
  }];
}

- (void)start:(KBCompletion)completion {
  MPXPCClient *helper = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" privileged:YES];
  [helper sendRequest:@"kbfs_load" params:nil completion:^(NSError *error, id value) {
    completion(error);
  }];
}

- (void)stop:(KBCompletion)completion {
  MPXPCClient *helper = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" privileged:YES];
  [helper sendRequest:@"kbfs_unload" params:nil completion:^(NSError *error, id value) {
    completion(error);
  }];
}

@end
