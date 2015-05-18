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
#import "KBInfoView.h"

@interface KBFuseComponent ()
@property KBInfoView *infoView;
@property NSString *version;
@end

@implementation KBFuseComponent

- (instancetype)init {
  if ((self = [super init])) {
    NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
    self.bundleVersion = info[@"KBFuseVersion"];
  }
  return self;
}

- (NSString *)name {
  return @"OSXFuse";
}

- (NSString *)info {
  return @"For the Keybase filesystem";
}

- (NSImage *)image {
  return [NSImage imageNamed:@"Fuse.icns"];
}

- (NSView *)contentView {
  [self componentDidUpdate];
  return _infoView;
}

- (void)componentDidUpdate {
  GHODictionary *info = [GHODictionary dictionary];

  info[@"Version"] = [self version];
  info[@"Bundle Version"] = self.bundleVersion;

  GHODictionary *statusInfo = [self componentStatusInfo];
  if (statusInfo) [info addEntriesFromOrderedDictionary:statusInfo];

  if (!_infoView) _infoView = [[KBInfoView alloc] init];
  [_infoView setProperties:info];
}

- (void)updateComponentStatus:(KBCompletion)completion {
  NSString *bundleVersion = self.bundleVersion;
  MPXPCClient *helper = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" priviledged:YES];
  [helper sendRequest:@"version" params:nil completion:^(NSError *error, NSDictionary *versions) {
    if (error) {
      self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusInstalled runtimeStatus:KBRuntimeStatusNotRunning info:nil];
      completion(error);
    } else {
      NSString *runningVersion = versions[@"fuseRunningVersion"];
      self.version = runningVersion;
      if ([runningVersion isEqualToString:bundleVersion]) {
        self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusInstalled runtimeStatus:KBRuntimeStatusRunning info:[GHODictionary d:@{@"Version": runningVersion}]];
        completion(nil);
      } else {
        self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusNeedsUpgrade runtimeStatus:KBRuntimeStatusRunning info:[GHODictionary d:@{@"Version": runningVersion, @"New version": bundleVersion}]];
        completion(nil);
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
