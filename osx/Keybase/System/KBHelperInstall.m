//
//  KBHelperInstall.m
//  Keybase
//
//  Created by Gabriel on 5/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBHelperInstall.h"
#import "KBDefines.h"
#import <ServiceManagement/ServiceManagement.h>
#import <MPMessagePack/MPXPCClient.h>
#import "KBLaunchCtl.h"

@interface KBHelperInstall ()
@property NSString *bundleVersion;
@end

@implementation KBHelperInstall

- (instancetype)init {
  if ((self = [super init])) {
    NSDictionary *info = [[NSBundle mainBundle] infoDictionary];
    _bundleVersion = info[@"KBHelperVersion"];
  }
  return self;
}

- (NSString *)info {
  return @"Helper Tool";
}

- (void)installStatus:(KBInstalledStatus)completion {
  if (![NSFileManager.defaultManager fileExistsAtPath:@"/Library/LaunchDaemons/keybase.Helper.plist" isDirectory:nil] &&
      ![NSFileManager.defaultManager fileExistsAtPath:@"/Library/PrivilegedHelperTools/keybase.Helper" isDirectory:nil]) {
    completion(nil, KBInstallStatusNotInstalled, nil);
    return;
  }

  NSString *bundleVersion = _bundleVersion;
  MPXPCClient *helper = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" priviledged:YES];
  [helper sendRequest:@"version" params:nil completion:^(NSError *error, NSDictionary *versions) {
    if (error) {
      completion(nil, KBInstallStatusInstalledNotRunning, nil);
    } else {
      NSString *runningVersion = versions[@"version"];
      if ([runningVersion isEqualToString:bundleVersion]) {
        completion(nil, KBInstallStatusInstalled, runningVersion);
      } else {
        completion(nil, KBInstallStatusNeedsUpgrade, NSStringWithFormat(@"%@ != %@", bundleVersion, runningVersion));
      }
    }
  }];
}

- (void)install:(KBInstalled)completion {
  NSError *error = nil;
  if ([self installPrivilegedServiceWithName:@"keybase.Helper" error:&error]) {
    if (error) {
      completion(error, KBInstallStatusError, nil);
    } else {
      completion(nil, KBInstallStatusInstalled, nil);
    }
  } else {
    if (!error) error = KBMakeError(-1, @"Failed to install privileged helper");
    completion(error, KBInstallStatusError, nil);
  }
}

- (BOOL)installPrivilegedServiceWithName:(NSString *)name error:(NSError **)error {
  AuthorizationRef authRef;
  OSStatus status = AuthorizationCreate(NULL, NULL, 0, &authRef);
  if (status != errAuthorizationSuccess) {
    if (error) *error = KBMakeError(status, @"Error creating auth");
    return NO;
  }

  AuthorizationItem authItem = {kSMRightBlessPrivilegedHelper, 0, NULL, 0};
  AuthorizationRights authRights = {1, &authItem};
  AuthorizationFlags flags =	kAuthorizationFlagDefaults | kAuthorizationFlagInteractionAllowed	| kAuthorizationFlagPreAuthorize | kAuthorizationFlagExtendRights;
  status = AuthorizationCopyRights(authRef, &authRights, kAuthorizationEmptyEnvironment, flags, NULL);
  if (status != errAuthorizationSuccess) {
    if (error) *error = [NSError errorWithDomain:NSOSStatusErrorDomain code:status userInfo:nil];
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
