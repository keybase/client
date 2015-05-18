//
//  KBHelperTool.m
//  Keybase
//
//  Created by Gabriel on 5/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBHelperTool.h"
#import "KBAppDefines.h"
#import <ServiceManagement/ServiceManagement.h>
#import <MPMessagePack/MPXPCClient.h>
#import "KBLaunchCtl.h"
#import "KBAppKit.h"
#import "KBInfoView.h"

@interface KBHelperTool ()
@property KBInfoView *infoView;
@property NSString *version;
@end

@implementation KBHelperTool

- (instancetype)init {
  if ((self = [super init])) {
    NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
    self.bundleVersion = info[@"KBHelperVersion"];
  }
  return self;
}

- (NSString *)name {
  return @"Helper";
}

- (NSString *)info {
  return @"Runs priviliged tasks";
}

- (NSImage *)image {
  return [KBIcons imageForIcon:KBIconGenericApp];
}

- (NSView *)contentView {
  [self componentDidUpdate];
  return _infoView;
}

- (void)componentDidUpdate {
  GHODictionary *info = [GHODictionary dictionary];
  info[@"Version"] = GHOrNull(_version);
  info[@"Bundle Version"] = GHOrNull(self.bundleVersion);

  GHODictionary *statusInfo = [self componentStatusInfo];
  if (statusInfo) [info addEntriesFromOrderedDictionary:statusInfo];

  if (!_infoView) _infoView = [[KBInfoView alloc] init];
  [_infoView setProperties:info];
}

- (void)updateComponentStatus:(KBCompletion)completion {
  if (![NSFileManager.defaultManager fileExistsAtPath:@"/Library/LaunchDaemons/keybase.Helper.plist" isDirectory:nil] &&
      ![NSFileManager.defaultManager fileExistsAtPath:@"/Library/PrivilegedHelperTools/keybase.Helper" isDirectory:nil]) {
    self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusNotInstalled runtimeStatus:KBRuntimeStatusNone info:nil];
    completion(nil);
    return;
  }

  NSString *bundleVersion = self.bundleVersion;
  GHODictionary *info = [GHODictionary dictionary];
  GHWeakSelf gself = self;
  MPXPCClient *helper = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" priviledged:YES];
  [helper sendRequest:@"version" params:nil completion:^(NSError *error, NSDictionary *versions) {
    if (error) {
      self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusInstalled runtimeStatus:KBRuntimeStatusNotRunning info:nil];
      completion(error);
    } else {
      NSString *runningVersion = versions[@"version"];
      gself.version = runningVersion;
      if (runningVersion) info[@"Version"] = runningVersion;
      if ([runningVersion isEqualToString:bundleVersion]) {
        self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusInstalled runtimeStatus:KBRuntimeStatusRunning info:info];
        completion(nil);
      } else {
        if (bundleVersion) info[@"New version"] = bundleVersion;
        self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusNeedsUpgrade runtimeStatus:KBRuntimeStatusRunning info:info];
        completion(nil);
      }
    }
  }];
}

- (void)install:(KBCompletion)completion {
  NSError *error = nil;
  if ([self installPrivilegedServiceWithName:@"keybase.Helper" error:&error]) {
    completion(nil);
  } else {
    if (!error) error = KBMakeError(-1, @"Failed to install privileged helper");
    completion(error);
  }
}

- (BOOL)installPrivilegedServiceWithName:(NSString *)name error:(NSError **)error {
  AuthorizationRef authRef;
  OSStatus osstatus = AuthorizationCreate(NULL, NULL, 0, &authRef);
  if (osstatus != errAuthorizationSuccess) {
    if (error) *error = KBMakeError(osstatus, @"Error creating auth");
    return NO;
  }

  AuthorizationItem authItem = {kSMRightBlessPrivilegedHelper, 0, NULL, 0};
  AuthorizationRights authRights = {1, &authItem};
  AuthorizationFlags flags =	kAuthorizationFlagDefaults | kAuthorizationFlagInteractionAllowed	| kAuthorizationFlagPreAuthorize | kAuthorizationFlagExtendRights;
  osstatus = AuthorizationCopyRights(authRef, &authRights, kAuthorizationEmptyEnvironment, flags, NULL);
  if (osstatus != errAuthorizationSuccess) {
    if (error) *error = [NSError errorWithDomain:NSOSStatusErrorDomain code:osstatus userInfo:nil];
    return NO;
  }

  CFErrorRef cerror = NULL;
  Boolean success = SMJobBless(kSMDomainSystemLaunchd, (__bridge CFStringRef)name, authRef, &cerror);
  if (!success) {
    if (error) *error = (NSError *)CFBridgingRelease(cerror);
    return NO;
  } else {
    return YES;
  }
}

@end
