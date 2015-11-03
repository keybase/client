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
#import "KBSemVersion.h"
#import "KBFormatter.h"

#import <IOKit/kext/KextManager.h>

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
  GHODictionary *statusInfo = [self.componentStatus statusInfo];
  if (statusInfo) [info addEntriesFromOrderedDictionary:statusInfo];
  if (!_infoView) _infoView = [[KBDebugPropertiesView alloc] init];
  [_infoView setProperties:info];
}

- (void)refreshComponent:(KBCompletion)completion {
  GHODictionary *info = [GHODictionary dictionary];
  KBSemVersion *bundleVersion = [KBSemVersion version:NSBundle.mainBundle.infoDictionary[@"KBFuseVersion"]];
  info[@"Bundle Version"] = [bundleVersion description];

  NSString *kextFuse2ID = @"com.github.osxfuse.filesystems.osxfusefs";
  NSString *kextFuse3ID = @"com.github.osxfuse.filesystems.osxfuse";

  NSDictionary *kexts = (__bridge NSDictionary *)KextManagerCopyLoadedKextInfo((__bridge CFArrayRef)@[kextFuse2ID, kextFuse3ID], NULL);

  NSString *kextID;
  if (kexts[kextFuse2ID] && kexts[kextFuse3ID]) {
    self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusError installAction:KBRInstallActionNone runtimeStatus:KBRuntimeStatusNone info:info error:KBMakeError(-1, @"Fuse installed but kext is not loaded")];
    completion(self.componentStatus.error);
    return;
  } else if (kexts[kextFuse3ID]) {
    kextID = kextFuse3ID;
  } else if (kexts[kextFuse2ID]) {
    kextID = kextFuse2ID;
  } else {
    // Not installed
    self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusNotInstalled installAction:KBRInstallActionInstall runtimeStatus:KBRuntimeStatusNone info:info error:nil];
    completion(nil);
    return;
  }

  info[@"Kext ID"] = kextID;
  NSDictionary *kextInfo = kexts[kextID];

  DDLogDebug(@"Kext info: %@", KBDescription(kextInfo));

  KBSemVersion *version = [KBSemVersion version:kextInfo[@"CFBundleVersion"]];
  if (!version) {
    self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusError installAction:KBRInstallActionNone runtimeStatus:KBRuntimeStatusNone info:info error:KBMakeError(-1, @"Kext is loaded but no version")];
    completion(nil);
    return;
  }

  info[@"Version"] = [version description];
  
  BOOL started = [kextInfo[@"OSBundleStarted"] boolValue];
  if (!started) {
    self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusError installAction:KBRInstallActionNone runtimeStatus:KBRuntimeStatusNone info:info error:KBMakeError(-1, @"Kext installed but isn't loaded")];
    completion(nil);
    return;
  }

  self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusInstalled installAction:KBRInstallActionNone runtimeStatus:KBRuntimeStatusNone info:info error:nil];
  completion(nil);
}

- (MPXPCClient *)helper {
  if (!_helper) _helper = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" privileged:YES];
  return _helper;
}

- (void)install:(KBCompletion)completion {
  NSString *source = [NSBundle.mainBundle.resourcePath stringByAppendingPathComponent:@"osxfusefs.bundle"];
  NSString *destination = @"/Library/Filesystems/osxfusefs.fs";
  NSString *kextID = @"com.github.osxfuse.filesystems.osxfusefs";

  [[self helper] sendRequest:@"kbfs_install" params:@[@{@"source": source, @"destination": destination, @"kextID": kextID}] completion:^(NSError *error, id value) {
    completion(error);
  }];
}

- (void)uninstall:(KBCompletion)completion {
  [[self helper] sendRequest:@"kbfs_uninstall" params:nil completion:^(NSError *error, id value) {
    completion(error);
  }];
}

- (void)start:(KBCompletion)completion {
  NSString *destination = @"/Library/Filesystems/osxfusefs.fs";
  NSString *kextID = @"com.github.osxfuse.filesystems.osxfusefs";

  [[self helper] sendRequest:@"kbfs_load" params:@[@{@"kextPath": destination, @"kextID": kextID}] completion:^(NSError *error, id value) {
    completion(error);
  }];
}

- (void)stop:(KBCompletion)completion {
  [[self helper] sendRequest:@"kbfs_unload" params:nil completion:^(NSError *error, id value) {
    completion(error);
  }];
}

@end
