//
//  KBHelperTool.m
//  Keybase
//
//  Created by Gabriel on 5/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBHelperTool.h"

#import "KBDebugPropertiesView.h"
#import "KBPrivilegedTask.h"

#import <ObjectiveSugar/ObjectiveSugar.h>
#import <ServiceManagement/ServiceManagement.h>
#import <MPMessagePack/MPXPCClient.h>

#import "KBSemVersion.h"
#import "KBFormatter.h"

#define PLIST_DEST (@"/Library/LaunchDaemons/keybase.Helper.plist")
#define HELPER_LOCATION (@"/Library/PrivilegedHelperTools/keybase.Helper")

@interface KBHelperTool ()
@property KBDebugPropertiesView *infoView;
@end

@implementation KBHelperTool

- (NSString *)name {
  return @"Privileged Helper";
}

- (NSString *)info {
  return @"Runs privileged tasks";
}

- (NSImage *)image {
  return [KBIcons imageForIcon:KBIconExtension];
}

- (NSView *)componentView {
  [self componentDidUpdate];
  return _infoView;
}

- (KBSemVersion *)bundleVersion {
  return [KBSemVersion version:NSBundle.mainBundle.infoDictionary[@"KBHelperVersion"] build:NSBundle.mainBundle.infoDictionary[@"KBHelperBuild"]];
}

- (void)componentDidUpdate {
  GHODictionary *info = [GHODictionary dictionary];
  GHODictionary *statusInfo = [self.componentStatus statusInfo];
  if (statusInfo) [info addEntriesFromOrderedDictionary:statusInfo];

  info[@"Plist"] = PLIST_DEST;

  if (!_infoView) _infoView = [[KBDebugPropertiesView alloc] init];
  [_infoView setProperties:info];
}

- (void)refreshComponent:(KBCompletion)completion {
  GHODictionary *info = [GHODictionary dictionary];
  KBSemVersion *bundleVersion = [self bundleVersion];
  info[@"Bundle Version"] = [bundleVersion description];

  if (![NSFileManager.defaultManager fileExistsAtPath:PLIST_DEST isDirectory:nil] &&
      ![NSFileManager.defaultManager fileExistsAtPath:HELPER_LOCATION isDirectory:nil]) {
    self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusNotInstalled installAction:KBRInstallActionInstall runtimeStatus:KBRuntimeStatusNone info:info error:nil];
    completion(nil);
    return;
  }

  MPXPCClient *helper = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" privileged:YES readOptions:MPMessagePackReaderOptionsUseOrderedDictionary];
  [helper sendRequest:@"version" params:nil completion:^(NSError *error, NSDictionary *versions) {
    if (error) {
      self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusError installAction:KBRInstallActionReinstall runtimeStatus:KBRuntimeStatusNone info:info error:error];
      completion(nil);
    } else {
      KBSemVersion *runningVersion = [KBSemVersion version:KBIfNull(versions[@"version"], @"") build:KBIfNull(versions[@"build"], nil)];
      if (runningVersion) info[@"Version"] = [runningVersion description];
      if ([bundleVersion isGreaterThan:runningVersion]) {
        if (bundleVersion) info[@"Bundle Version"] = [bundleVersion description];
        self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusNeedsUpgrade installAction:KBRInstallActionUpgrade runtimeStatus:KBRuntimeStatusRunning info:info error:nil];
        completion(nil);
      } else {
        self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusInstalled installAction:KBRInstallActionNone runtimeStatus:KBRuntimeStatusRunning info:info error:nil];
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
    if (!error) error = KBMakeError(KBErrorCodeInstallError, @"Failed to install privileged helper");
    completion(error);
  }
}

- (AuthorizationRef)authorization:(NSError **)error {
  AuthorizationRef authRef;
  OSStatus createStatus = AuthorizationCreate(NULL, NULL, 0, &authRef);
  if (createStatus != errAuthorizationSuccess) {
    if (error) *error = KBMakeError(createStatus, @"Error creating auth: %@", @(createStatus));
    return nil;
  }

  AuthorizationItem authItem = {kSMRightBlessPrivilegedHelper, 0, NULL, 0};
  AuthorizationRights authRights = {1, &authItem};
  AuthorizationFlags flags =	kAuthorizationFlagDefaults | kAuthorizationFlagInteractionAllowed	| kAuthorizationFlagPreAuthorize | kAuthorizationFlagExtendRights;
  OSStatus authResult = AuthorizationCopyRights(authRef, &authRights, kAuthorizationEmptyEnvironment, flags, NULL);
  if (authResult != errAuthorizationSuccess) {
    if (error) *error = KBMakeError(authResult, @"Error copying rights: %@", @(authResult));
    return nil;
  }

  return authRef;
}

- (BOOL)installPrivilegedServiceWithName:(NSString *)name error:(NSError **)error {
  AuthorizationRef authRef = [self authorization:error];
  if (!authRef) {
    return NO;
  }
  CFErrorRef cerror = NULL;
  Boolean success = SMJobBless(kSMDomainSystemLaunchd, (__bridge CFStringRef)name, authRef, &cerror);

  AuthorizationFree(authRef, kAuthorizationFlagDefaults);

  if (!success) {
    if (error) *error = (NSError *)CFBridgingRelease(cerror);
    return NO;
  } else {
    return YES;
  }
}

/*
- (BOOL)uninstallPrivilegedServiceWithName:(NSString *)name error:(NSError **)error {
  AuthorizationRef authRef = [self authorization:error];
  if (!authRef) {
    return NO;
  }
  CFErrorRef cerror = NULL;
  BOOL success = SMJobRemove(kSMDomainSystemLaunchd, (__bridge CFStringRef)(name), authRef, true, &cerror);
  AuthorizationFree(authRef, kAuthorizationFlagDefaults);

  if (!success) {
    if (error) *error = (NSError *)CFBridgingRelease(cerror);
    return NO;
  } else {
    return YES;
  }
}
 */

- (void)uninstall:(KBCompletion)completion {
  completion(KBMakeError(-1, @"Uninstall for privileged helper is unsafe"));
//  NSError *error = nil;
//  [self uninstallPrivilegedServiceWithName:@"keybase.Helper" error:&error];
//  completion(error);
}

- (void)start:(KBCompletion)completion {
  completion(KBMakeError(KBErrorCodeUnsupported, @"Unsupported"));
}

- (void)stop:(KBCompletion)completion {
  completion(KBMakeError(KBErrorCodeUnsupported, @"Unsupported"));
}

@end
