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

@implementation KBHelperInstall

- (NSString *)info {
  return @"keybase.Helper (Fuse)";
}

- (void)installStatus:(KBInstallStatus)completion {
  MPXPCClient *helper = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" priviledged:YES];
  [helper sendRequest:@"version" params:nil completion:^(NSError *error, NSDictionary *versions) {
    if (error) {
      completion(error, NO);
    } else {
      completion(nil, YES);
    }
  }];
}

- (void)install:(void (^)(NSError *error, BOOL installed))completion {
  NSError *error = nil;
  if ([self installPrivilegedServiceWithName:@"keybase.Helper" error:&error]) {
    MPXPCClient *helper = [[MPXPCClient alloc] initWithServiceName:@"keybase.Helper" priviledged:YES];
    [helper sendRequest:@"load_kbfs" params:nil completion:^(NSError *error, id value) {
      if (error) {
        completion(error, NO);
      } else {
        completion(error, YES);
      }
    }];
  } else {
    if (!error) error = KBMakeError(-1, @"Failed to install privileged helper");
    completion(error, NO);
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
