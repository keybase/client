//
//  KBHelperClient.m
//  Keybase
//
//  Created by Gabriel on 4/16/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBHelperClient.h"
#import "KBDefines.h"

#import <ServiceManagement/ServiceManagement.h>
#import "AppDelegate.h"

@interface KBHelperClient ()
@property xpc_connection_t connection;
@end

@implementation KBHelperClient

- (BOOL)connect:(NSError **)error {
  _connection = xpc_connection_create_mach_service("keybase.Helper", NULL, XPC_CONNECTION_MACH_SERVICE_PRIVILEGED);

  if (!_connection) {
    if (error) *error = KBMakeError(-1, @"Failed to create XPC connection");
    return NO;
  }

  xpc_connection_set_event_handler(_connection, ^(xpc_object_t event) {

    GHDebug(@"Handle event: %@", event);

    xpc_type_t type = xpc_get_type(event);

    if (type == XPC_TYPE_ERROR) {
      if (event == XPC_ERROR_CONNECTION_INTERRUPTED) {
        // Interrupted
      } else if (event == XPC_ERROR_CONNECTION_INVALID) {
        // Invalid connection
      } else {
        // Unknown error
      }
    } else {
      // Unexpected event
    }
  });

  xpc_connection_resume(_connection);
  return YES;
}

- (void)sendRequest:(NSDictionary *)request completion:(void (^)(NSError *error, NSDictionary *response))completion {
  NSAssert(_connection, @"No connection");
  xpc_object_t message = xpc_dictionary_create(NULL, NULL, 0);

  NSData *dataRequest = [request mp_messagePack];
  xpc_dictionary_set_data(message, "data", [dataRequest bytes], [dataRequest length]);

  xpc_connection_send_message_with_reply(_connection, message, dispatch_get_main_queue(), ^(xpc_object_t event) {

    GHDebug(@"Reply: %@", event);

    size_t length = 0;
    const void *buffer = xpc_dictionary_get_data(event, "data", &length);
    NSData *dataResponse = [NSData dataWithBytes:buffer length:length];

    NSDictionary *response = [dataResponse mp_dict:nil];
    completion(nil, response);
  });
}

- (BOOL)install:(NSError **)error {
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
  Boolean success = SMJobBless(kSMDomainSystemLaunchd, CFSTR("keybase.Helper"), authRef, &cerror);
  if (!success) {
    if (error) *error = (NSError *)CFBridgingRelease(cerror);
    return NO;
  } else {
    return YES;
  }
}

@end
