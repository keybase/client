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

- (NSString *)info {
  return @"OSXFuse";
}

- (void)installStatus:(KBInstalledStatus)completion {
  NSString *bundleVersion = _bundleVersion;
  MPXPCClient *helper = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" priviledged:YES];
  [helper sendRequest:@"version" params:nil completion:^(NSError *error, NSDictionary *versions) {
    if (error) {
      completion(nil, KBInstallStatusInstalledNotRunning, nil);
    } else {
      NSString *runningVersion = versions[@"fuseRunningVersion"];
      if ([runningVersion isEqualToString:bundleVersion]) {
        completion(nil, KBInstallStatusInstalled, bundleVersion);
      } else {
        completion(nil, KBInstallStatusNeedsUpgrade, NSStringWithFormat(@"%@ != %@", runningVersion, bundleVersion));
      }
    }
  }];
}

- (void)install:(KBInstalled)completion {
  MPXPCClient *helper = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" priviledged:YES];
  [helper sendRequest:@"kbfs_install" params:nil completion:^(NSError *error, id value) {
    if (error) {
      completion(error, KBInstallStatusNotInstalled, nil);
    } else {
      completion(error, KBInstallStatusInstalled, nil);
    }
  }];
}

@end
