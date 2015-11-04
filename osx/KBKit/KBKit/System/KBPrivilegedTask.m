//
//  KBPrivilegedTask.m
//  Keybase
//
//  Created by Gabriel on 4/15/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPrivilegedTask.h"

#import "KBDefines.h"

@interface KBPrivilegedTask ()
@property AuthorizationRef authorizationRef;
@end

@implementation KBPrivilegedTask

+ (BOOL)execute:(NSString *)cmd args:(NSArray *)args error:(NSError **)error {
  KBPrivilegedTask *task = [[KBPrivilegedTask alloc] init];
  return [task execute:cmd args:args error:error];
}

- (BOOL)authorize:(NSString *)cmd error:(NSError **)error {
  if (_authorizationRef) return YES;
  OSStatus status = noErr;
  status = AuthorizationCreate(NULL, kAuthorizationEmptyEnvironment, kAuthorizationFlagDefaults, &_authorizationRef);
  if (status != errAuthorizationSuccess) {
    if (error) *error = KBMakeError(status, @"Failed to create authorization");
    _authorizationRef = nil;
    return NO;
  }

  const char *cmdPath = [cmd fileSystemRepresentation];
  AuthorizationItem authItem = {kAuthorizationRightExecute, strlen(cmdPath), &cmdPath, 0};
  AuthorizationRights authRights = {1, &authItem};
  AuthorizationFlags flags = kAuthorizationFlagDefaults | kAuthorizationFlagInteractionAllowed | kAuthorizationFlagPreAuthorize | kAuthorizationFlagExtendRights;

  status = AuthorizationCopyRights(_authorizationRef, &authRights, kAuthorizationEmptyEnvironment, flags, NULL);
  if (status != errAuthorizationSuccess) {
    if (error) *error = KBMakeError(status, @"Failed to copy rights");
    _authorizationRef = nil;
    return NO;
  }

  return YES;
}

- (BOOL)execute:(NSString *)cmd args:(NSArray *)args error:(NSError **)error {
  if (![self authorize:cmd error:error]) {
    return NO;
  }

  OSStatus status = noErr;
  status = errAuthorizationDenied;
  // Deprecated
  /*
  const char *cmdPath = [cmd fileSystemRepresentation];
  FILE *pipe = NULL;
  char *const *cargs = [self convertArray:args];
  status = AuthorizationExecuteWithPrivileges(_authorizationRef, cmdPath, kAuthorizationFlagDefaults, cargs, &pipe);
   */
  if (status != errAuthorizationSuccess) {
    if (error) *error = KBMakeError(status, @"Failed to run: %@", @(status));
    return NO;
  }

  return YES;
}

- (char **)convertArray:(NSArray *)array {
  NSUInteger count = [array count];
  char **carray = (char **)malloc((count + 1) * sizeof(char*));

  for (NSInteger i = 0; i < count; i++) {
    carray[i] = strdup([[array objectAtIndex:i] UTF8String]);
  }
  carray[count] = NULL;
  return carray;
}


@end
