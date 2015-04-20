//
//  KBPriviledgedTask.m
//  Keybase
//
//  Created by Gabriel on 4/15/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPriviledgedTask.h"

#import "KBDefines.h"

@implementation KBPriviledgedTask

- (BOOL)execute:(NSString *)cmd args:(NSArray *)args error:(NSError **)error {
  AuthorizationRef authorizationRef;
  OSStatus status = noErr;
  status = AuthorizationCreate(NULL, kAuthorizationEmptyEnvironment, kAuthorizationFlagDefaults, &authorizationRef);
  if (status != errAuthorizationSuccess) {
    if (error) *error = KBMakeError(status, @"Failed to create authorization");
    return NO;
  }

  const char *cmdPath = [cmd fileSystemRepresentation];
  AuthorizationItem authItem = {kAuthorizationRightExecute, strlen(cmdPath), &cmdPath, 0};
  AuthorizationRights authRights = {1, &authItem};
  AuthorizationFlags flags = kAuthorizationFlagDefaults | kAuthorizationFlagInteractionAllowed | kAuthorizationFlagPreAuthorize | kAuthorizationFlagExtendRights;

  status = AuthorizationCopyRights(authorizationRef, &authRights, kAuthorizationEmptyEnvironment, flags, NULL);
  if (status != errAuthorizationSuccess) {
    if (error) *error = KBMakeError(status, @"Failed to copy rights");
    return NO;
  }

  // Using the priviledged helper
  //FILE *pipe = NULL;
  //char *const *cargs = [self convertArray:args];
  //status = AuthorizationExecuteWithPrivileges(authorizationRef, cmdPath, kAuthorizationFlagDefaults, cargs, &pipe);
  status = errAuthorizationDenied;
  if (status != errAuthorizationSuccess) {
    if (error) *error = KBMakeError(status, @"Failed to run");
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
