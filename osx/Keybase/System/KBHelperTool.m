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
#import "KBAppDefines.h"
#import "KBInfoView.h"
#import "KBPrivilegedTask.h"

#define PLIST_DEST (@"/Library/LaunchDaemons/keybase.Helper.plist")
#define HELPER_LOCATION (@"/Library/PrivilegedHelperTools/keybase.Helper")

@interface KBHelperTool ()
@property KBInfoView *infoView;
@property NSString *version;
@end

@implementation KBHelperTool

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

- (NSString *)bundleVersion {
  return [[NSBundle mainBundle] infoDictionary][@"KBHelperVersion"];
}

- (void)componentDidUpdate {
  GHODictionary *info = [GHODictionary dictionary];
  info[@"Version"] = GHOrNull(_version);
  info[@"Bundle Version"] = GHOrNull(self.bundleVersion);

  GHODictionary *statusInfo = [self componentStatusInfo];
  if (statusInfo) [info addEntriesFromOrderedDictionary:statusInfo];

  info[@"Plist"] = PLIST_DEST;

  if (!_infoView) _infoView = [[KBInfoView alloc] init];
  [_infoView setProperties:info];
}

- (void)updateComponentStatus:(KBCompletion)completion {
  _version = nil;
  if (![NSFileManager.defaultManager fileExistsAtPath:PLIST_DEST isDirectory:nil] &&
      ![NSFileManager.defaultManager fileExistsAtPath:HELPER_LOCATION isDirectory:nil]) {
    self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusNotInstalled runtimeStatus:KBRuntimeStatusNone info:nil];
    completion(nil);
    return;
  }

  NSString *bundleVersion = self.bundleVersion;
  GHODictionary *info = [GHODictionary dictionary];
  GHWeakSelf gself = self;
  MPXPCClient *helper = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" privileged:YES];
  [helper sendRequest:@"version" params:nil completion:^(NSError *error, NSDictionary *versions) {
    if (error) {
      self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusInstalled runtimeStatus:KBRuntimeStatusNotRunning info:nil];
      completion(error);
    } else {
      NSString *runningVersion = KBIfNull(versions[@"version"], nil);
      gself.version = runningVersion;
      if (runningVersion) info[@"Version"] = runningVersion;
      if ([runningVersion isEqualTo:bundleVersion]) {
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

- (void)uninstall:(KBCompletion)completion {
  NSString *path = NSStringWithFormat(@"%@/bin/uninstall_helper", NSBundle.mainBundle.sharedSupportPath);

  NSError *error = nil;
  KBPrivilegedTask *task = [[KBPrivilegedTask alloc] init];
  [task execute:@"/bin/sh" args:@[path] error:&error];
  if (error) {
    completion(error);
    return;
  }
  completion(nil);

  /*
  NSArray *commands = @[
                        @{@"cmd": @"/bin/rm", @"args": @[@"/Library/PrivilegedHelperTools/keybase.Helper"]},
                        @{@"cmd": @"/bin/launchctl", @"args": @[@"unload", @"/Library/LaunchDaemons/keybase.Helper.plist"]},
                        @{@"cmd": @"/bin/rm", @"args": @[@"/Library/LaunchDaemons/keybase.Helper.plist"]},];

  NSError *error = nil;
  KBPrivilegedTask *task = [[KBPrivilegedTask alloc] init];
  for (NSArray *command in commands) {
    [task execute:command[@"cmd"] args:command[@"args"] error:&error];
    if (error) {
      completion(error);
      return;
    }
  }
  completion(nil);
   */
}

- (void)start:(KBCompletion)completion {
  completion(KBMakeError(-1, @"Unsupported"));
}

- (void)stop:(KBCompletion)completion {
  completion(KBMakeError(-1, @"Unsupported"));
}

@end
