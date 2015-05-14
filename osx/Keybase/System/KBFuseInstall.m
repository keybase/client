//
//  KBFuseInstall.m
//  Keybase
//
//  Created by Gabriel on 5/11/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFuseInstall.h"

#import "KBDefines.h"
#import <MPMessagePack/MPXPCClient.h>

@interface KBFuseInstall ()
@property NSString *bundleVersion;
@end

@implementation KBFuseInstall

- (instancetype)init {
  if ((self = [super init])) {
    NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
    _bundleVersion = info[@"KBFuseVersion"];
  }
  return self;
}

- (NSString *)name {
  return @"OSXFuse";
}

- (void)installStatus:(KBInstallableStatus)completion {
  NSString *bundleVersion = _bundleVersion;
  MPXPCClient *helper = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" priviledged:YES];
  [helper sendRequest:@"version" params:nil completion:^(NSError *error, NSDictionary *versions) {
    if (error) {
      completion([KBInstallStatus installStatusWithStatus:KBInstalledStatusInstalled runtimeStatus:KBRuntimeStatusNotRunning info:nil]);
    } else {
      NSString *runningVersion = versions[@"fuseRunningVersion"];
      if ([runningVersion isEqualToString:bundleVersion]) {
        completion([KBInstallStatus installStatusWithStatus:KBInstalledStatusInstalled runtimeStatus:KBRuntimeStatusRunning info:[GHODictionary d:@{@"version": runningVersion}]]);
      } else {
        completion([KBInstallStatus installStatusWithStatus:KBInstalledStatusNeedsUpgrade runtimeStatus:KBRuntimeStatusRunning info:[GHODictionary d:@{@"version": runningVersion, @"New version": bundleVersion}]]);
      }
    }
  }];
}

- (void)install:(KBCompletion)completion {
  MPXPCClient *helper = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" priviledged:YES];
  [helper sendRequest:@"kbfs_install" params:nil completion:^(NSError *error, id value) {
    completion(error);
  }];
}

@end
