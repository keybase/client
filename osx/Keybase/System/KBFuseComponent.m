//
//  KBFuseInstall.m
//  Keybase
//
//  Created by Gabriel on 5/11/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFuseComponent.h"

#import "KBAppDefines.h"
#import <MPMessagePack/MPXPCClient.h>

@interface KBFuseComponent ()
@property NSString *bundleVersion;
@end

@implementation KBFuseComponent

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

- (void)status:(KBOnComponentStatus)completion {
  NSString *bundleVersion = _bundleVersion;
  MPXPCClient *helper = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" priviledged:YES];
  [helper sendRequest:@"version" params:nil completion:^(NSError *error, NSDictionary *versions) {
    if (error) {
      completion([KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusInstalled runtimeStatus:KBRuntimeStatusNotRunning info:nil]);
    } else {
      NSString *runningVersion = versions[@"fuseRunningVersion"];
      if ([runningVersion isEqualToString:bundleVersion]) {
        completion([KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusInstalled runtimeStatus:KBRuntimeStatusRunning info:[GHODictionary d:@{@"Version": runningVersion}]]);
      } else {
        completion([KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusNeedsUpgrade runtimeStatus:KBRuntimeStatusRunning info:[GHODictionary d:@{@"Version": runningVersion, @"New version": bundleVersion}]]);
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
