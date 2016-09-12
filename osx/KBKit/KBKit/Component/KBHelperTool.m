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

#define HELPER_LOCATION (@"/Library/PrivilegedHelperTools/keybase.Helper")

@interface KBHelperTool () <MPLog>
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
  MPXPCClient *client = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" privileged:YES readOptions:MPMessagePackReaderOptionsUseOrderedDictionary];
  client.retryMaxAttempts = 4;
  client.retryDelay = 0.5;
  client.timeout = 10.0;
  return client;
}

- (MPXPCClient *)helper {
  if (!_helper) {
    _helper = [KBHelperTool helper];
    _helper.logDelegate = self;
  }
  return _helper;
}

- (void)componentDidUpdate {
  GHODictionary *info = [GHODictionary dictionary];
  GHODictionary *statusInfo = [self.componentStatus statusInfo];
  if (statusInfo) [info addEntriesFromOrderedDictionary:statusInfo];

  if (!_infoView) _infoView = [[KBDebugPropertiesView alloc] init];
  [_infoView setProperties:info];
}

- (void)log:(MPLogLevel)level format:(NSString *)format, ... {
  va_list args;
  va_start(args, format);
  DDLogInfo(@"%@", [[NSString alloc] initWithFormat:format arguments:args]);
  va_end(args);
}

- (void)refreshComponent:(KBRefreshComponentCompletion)completion {
  GHODictionary *info = [GHODictionary dictionary];
  KBSemVersion *bundleVersion = [self bundleVersion];
  info[@"Bundle Version"] = [bundleVersion description];

  if (![NSFileManager.defaultManager fileExistsAtPath:HELPER_LOCATION isDirectory:nil]) {
    self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusNotInstalled installAction:KBRInstallActionInstall info:info error:nil];
    completion(self.componentStatus);
    return;
  }

  [self.helper sendRequest:@"version" params:nil completion:^(NSError *error, NSDictionary *versions) {
    if (error) {
      self.componentStatus = [KBComponentStatus componentStatusWithInstallStatus:KBRInstallStatusError installAction:KBRInstallActionReinstall info:info error:error];
      completion(self.componentStatus);
    } else {
      DDLogDebug(@"Helper version: %@", versions);
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
    if (error) {
      *error = [NSError errorWithDomain:@"keybase.Helper" code:authResult userInfo:@{NSLocalizedDescriptionKey:[NSString stringWithFormat:@"Error copying rights: %@", @(authResult)], NSLocalizedRecoveryOptionsErrorKey: @[@"Quit"]}];
    }
    return nil;
  }

  return authRef;
}

- (BOOL)installPrivilegedServiceWithName:(NSString *)name error:(NSError **)error {
  AuthorizationRef authRef = [self authorization:error];
  if (!authRef) {
    return NO;
  }

  NSString *helperPath = HELPER_LOCATION;
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

- (void)uninstall:(KBCompletion)completion {
  [self removeIfExists:HELPER_LOCATION completion:completion];
  // TODO: Maybe, we should also kill the running helper process, but that requires more privilege, and
  // isn't a big deal that we don't kill it on uninstall. The plist should be left untouched because if
  // removed seems to cause problems if the helper tool needs to be re-installed.
}

- (void)removeIfExists:(NSString *)path completion:(KBCompletion)completion {
  if ([NSFileManager.defaultManager fileExistsAtPath:path]) {
    DDLogDebug(@"Removing %@", path);
    [self.helper sendRequest:@"remove" params:@[@{@"path": path}] completion:^(NSError *err, id value) {
      completion(err);
    }];
  } else {
    completion(nil);
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
