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

@interface KBHelperTool ()
@property NSString *bundleVersion;
@end

@implementation KBHelperTool

@synthesize status;

- (instancetype)init {
  if ((self = [super init])) {
    NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
    _bundleVersion = info[@"KBHelperVersion"];
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

- (NSView *)contentView { return nil; }

- (void)status:(KBOnComponentStatus)completion {
  if (![NSFileManager.defaultManager fileExistsAtPath:@"/Library/LaunchDaemons/keybase.Helper.plist" isDirectory:nil] &&
      ![NSFileManager.defaultManager fileExistsAtPath:@"/Library/PrivilegedHelperTools/keybase.Helper" isDirectory:nil]) {
    completion([KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusNotInstalled runtimeStatus:KBRuntimeStatusNone info:nil]);
    return;
  }

  NSString *bundleVersion = _bundleVersion;
  GHODictionary *info = [GHODictionary dictionary];
  MPXPCClient *helper = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" priviledged:YES];
  [helper sendRequest:@"version" params:nil completion:^(NSError *error, NSDictionary *versions) {
    if (error) {
      completion([KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusInstalled runtimeStatus:KBRuntimeStatusNotRunning info:nil]);
    } else {
      NSString *runningVersion = versions[@"version"];
      if (runningVersion) info[@"Version"] = runningVersion;
      if ([runningVersion isEqualToString:bundleVersion]) {
        completion([KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusInstalled runtimeStatus:KBRuntimeStatusRunning info:info]);
      } else {
        if (bundleVersion) info[@"New version"] = bundleVersion;
        completion([KBComponentStatus componentStatusWithInstallStatus:KBInstallStatusNeedsUpgrade runtimeStatus:KBRuntimeStatusRunning info:info]);
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
