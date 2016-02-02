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

#import "KBSemVersion.h"
#import "KBFormatter.h"

#define PLIST_DEST (@"/Library/LaunchDaemons/keybase.Helper.plist")
#define HELPER_LOCATION (@"/Library/PrivilegedHelperTools/keybase.Helper")

@interface KBHelperTool ()
@property KBDebugPropertiesView *infoView;
@property (nonatomic) MPXPCClient *helper;
@end

@implementation KBHelperTool

- (instancetype)initWithConfig:(KBEnvConfig *)config {
  if ((self = [self initWithConfig:config name:@"Privileged Helper" info:@"Runs privileged tasks" image:[KBIcons imageForIcon:KBIconExtension]])) {
    
  }
  return self;
}

- (NSView *)componentView {
  [self componentDidUpdate];
  return _infoView;
}

- (KBSemVersion *)bundleVersion {
  return [KBSemVersion version:NSBundle.mainBundle.infoDictionary[@"KBHelperVersion"] build:nil];
}

+ (MPXPCClient *)helper {
  return [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" privileged:YES readOptions:MPMessagePackReaderOptionsUseOrderedDictionary];
}

- (MPXPCClient *)helper {
  // Always use a new helper tool since it can be interrupted if stale or updated.
  [_helper close];
  _helper = [KBHelperTool helper];
  return _helper;
}

- (void)componentDidUpdate {
  GHODictionary *info = [GHODictionary dictionary];
  GHODictionary *statusInfo = [self.componentStatus statusInfo];
  if (statusInfo) [info addEntriesFromOrderedDictionary:statusInfo];

  info[@"Plist"] = PLIST_DEST;

  if (!_infoView) _infoView = [[KBDebugPropertiesView alloc] init];
  [_infoView setProperties:info];
}

- (void)refreshComponent:(KBRefreshComponentCompletion)completion {
  GHODictionary *info = [GHODictionary dictionary];
  KBSemVersion *bundleVersion = [self bundleVersion];
  info[@"Bundle Version"] = [bundleVersion description];

  if (![NSFileManager.defaultManager fileExistsAtPath:PLIST_DEST isDirectory:nil] &&
      ![NSFileManager.defaultManager fileExistsAtPath:HELPER_LOCATION isDirectory:nil]) {
    self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusNotInstalled installAction:KBRInstallActionInstall info:info error:nil];
    completion(self.componentStatus);
    return;
  }

  [self.helper sendRequest:@"version" params:nil completion:^(NSError *error, NSDictionary *versions) {
    if (error) {
      self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusError installAction:KBRInstallActionReinstall info:info error:error];
      completion(self.componentStatus);
    } else {
      KBSemVersion *runningVersion = [KBSemVersion version:KBIfNull(versions[@"version"], @"") build:nil];
      if (runningVersion) info[@"Version"] = [runningVersion description];
      if ([bundleVersion isGreaterThan:runningVersion]) {
        if (bundleVersion) info[@"Bundle Version"] = [bundleVersion description];
        self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusInstalled installAction:KBRInstallActionUpgrade info:info error:nil];
        completion(self.componentStatus);
      } else {
        self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusInstalled installAction:KBRInstallActionNone info:info error:nil];
        completion(self.componentStatus);
      }
    }
  }];
}

- (void)install:(KBCompletion)completion {
  [self refreshComponent:^(KBComponentStatus *cs) {
    if ([cs needsInstallOrUpgrade]) {
      [self _install:completion];
    } else {
      completion(nil);
    }
  }];
}

- (void)_install:(KBCompletion)completion {
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

  NSString *helperPath = @"/Library/PrivilegedHelperTools/keybase.Helper";
  // It's unsafe to update privileged helper tools.
  // https://openradar.appspot.com/20446733
  DDLogDebug(@"Removing %@", helperPath);
  if ([NSFileManager.defaultManager fileExistsAtPath:helperPath]) {
    char *tool = "/bin/rm";
    char *args[] = {"-f", (char *)[helperPath UTF8String], NULL};
    FILE *pipe = NULL;
    AuthorizationExecuteWithPrivileges(authRef, tool, kAuthorizationFlagDefaults, args, &pipe);
  }

  CFErrorRef cerror = NULL;
  DDLogDebug(@"Installing helper tool via SMJobBless");
  Boolean success = SMJobBless(kSMDomainSystemLaunchd, (__bridge CFStringRef)name, authRef, &cerror);

  // Let's attempt it again on error (since it's flakey)
  if (!success) {
    DDLogDebug(@"Failed, retrying");
    success = SMJobBless(kSMDomainSystemLaunchd, (__bridge CFStringRef)name, authRef, &cerror);
  }

  AuthorizationFree(authRef, kAuthorizationFlagDestroyRights);

  if (!success) {
    if (error) *error = (NSError *)CFBridgingRelease(cerror);
    return NO;
  } else {
    DDLogDebug(@"Helper tool installed");
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

@end
