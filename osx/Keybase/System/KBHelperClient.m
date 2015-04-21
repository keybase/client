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
@property NSInteger messageId;
@end

@implementation KBHelperClient

- (BOOL)connect:(NSError **)error {
  _connection = xpc_connection_create_mach_service("keybase.Helper", NULL, XPC_CONNECTION_MACH_SERVICE_PRIVILEGED);

  if (!_connection) {
    if (error) *error = KBMakeError(-1, @"Failed to create XPC connection");
    return NO;
  }

  GHWeakSelf gself = self;
  xpc_connection_set_event_handler(_connection, ^(xpc_object_t event) {
    GHDebug(@"Handle event: %@", event);
    xpc_type_t type = xpc_get_type(event);
    if (type == XPC_TYPE_ERROR) {
      if (event == XPC_ERROR_CONNECTION_INTERRUPTED) {
        // Interrupted
      } else if (event == XPC_ERROR_CONNECTION_INVALID) {
        gself.connection = nil;
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

- (void)sendRequest:(NSString *)method params:(NSArray *)params completion:(void (^)(NSError *error, NSArray *response))completion {
  NSAssert(_connection, @"No connection");
  NSError *error = nil;
  xpc_object_t message = [self XPCObjectForRequestWithMethod:method params:params error:&error];
  if (!message) {
    completion(error, nil);
    return;
  }

  xpc_connection_send_message_with_reply(_connection, message, dispatch_get_main_queue(), ^(xpc_object_t event) {
    GHDebug(@"Reply: %@", event);
    NSError *error = nil;
    size_t length = 0;
    const void *buffer = xpc_dictionary_get_data(event, "data", &length);
    NSData *dataResponse = [NSData dataWithBytes:buffer length:length];
    NSArray *response = [self responseForData:dataResponse error:&error];
    completion(error, response);
  });
}

- (xpc_object_t)XPCObjectForRequestWithMethod:(NSString *)method params:(NSArray *)params error:(NSError **)error {
  // Uses msgpack-rpc for request/response.
  // Could use remote objects but want to avoid reflection and magic especially if its source.
  NSArray *request = @[@(0), @(++_messageId), method, (params ? params : NSNull.null)];
  NSData *dataRequest = [request mp_messagePack:0 error:error];
  if (!dataRequest) {
    return nil;
  }

  // XPC request object must be dictionary so put data in {"data": data} dictionary.
  xpc_object_t message = xpc_dictionary_create(NULL, NULL, 0);
  xpc_dictionary_set_data(message, "data", [dataRequest bytes], [dataRequest length]);
  return message;
}

- (NSArray *)responseForData:(NSData *)data error:(NSError **)error {
  return [data mp_array:error];
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
