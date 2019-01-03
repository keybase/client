//
//  MPXPCClient.m
//  MPMessagePack
//
//  Created by Gabriel on 5/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "MPXPCClient.h"

#import "MPDefines.h"
#import "NSArray+MPMessagePack.h"
#import "NSData+MPMessagePack.h"
#import "MPXPCProtocol.h"
#import "MPRPCProtocol.h"


@interface MPXPCClient ()
@property NSString *serviceName;
@property BOOL privileged;
@property MPMessagePackReaderOptions readOptions;

@property xpc_connection_t connection;
@property NSInteger messageId;
@end

@implementation MPXPCClient

- (instancetype)initWithServiceName:(NSString *)serviceName privileged:(BOOL)privileged {
  return [self initWithServiceName:serviceName privileged:privileged readOptions:0];
}

- (instancetype)initWithServiceName:(NSString *)serviceName privileged:(BOOL)privileged readOptions:(MPMessagePackReaderOptions)readOptions {
  if ((self = [super init])) {
    _serviceName = serviceName;
    _privileged = privileged;
    _retryMaxAttempts = 1; // No retry by default (only 1 attempt is made)
    _readOptions = readOptions;
  }
  return self;
}

- (BOOL)connect:(NSError **)error {
  [self.logDelegate log:MPLogLevelInfo format:@"Connecting to %@ (privileged=%@)", _serviceName, @(_privileged)];
  _connection = xpc_connection_create_mach_service([_serviceName UTF8String], NULL, _privileged ? XPC_CONNECTION_MACH_SERVICE_PRIVILEGED : 0);

  if (!_connection) {
    if (error) *error = MPMakeError(MPXPCErrorCodeInvalidConnection, @"Failed to create connection");
    return NO;
  }

  MPWeakSelf wself = self;
  xpc_connection_set_event_handler(_connection, ^(xpc_object_t event) {
    xpc_type_t type = xpc_get_type(event);
    if (type == XPC_TYPE_ERROR) {
      if (event == XPC_ERROR_CONNECTION_INTERRUPTED) {
        // Interrupted
        [wself.logDelegate log:MPLogLevelWarn format:@"Connection interrupted"];
      } else if (event == XPC_ERROR_CONNECTION_INVALID) {
        [wself.logDelegate log:MPLogLevelWarn format:@"Connection invalid, clearing connection"];
        if (wself.connection) {
          dispatch_async(dispatch_get_main_queue(), ^{
            wself.connection = nil;
            [wself.logDelegate log:MPLogLevelWarn format:@"Cleared connection"];
          });
        }
      } else {
        // Unknown error
      }
    } else {
      // Unexpected event
    }
  });

  xpc_connection_resume(_connection);
  [self.logDelegate log:MPLogLevelInfo format:@"Connected"];
  return YES;
}

- (void)close {
  [self.logDelegate log:MPLogLevelInfo format:@"Closing connection"];
  if (_connection) {
    xpc_connection_cancel(_connection);
    _connection = nil;
  }
}

- (void)sendRequest:(NSString *)method params:(NSArray *)params completion:(void (^)(NSError *error, id value))completion {
  __block BOOL replied = NO;
  static NSInteger requestId = 0;
  if (_timeout > 0) {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, _timeout * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
      if (!replied) {
        replied = YES;
        completion(MPMakeError(MPXPCErrorCodeTimeout, @"Timeout"), nil);
      }
    });
  }
  NSUInteger rid = requestId++;
  //[self.logDelegate log:MPLogLevelVerbose format:@"Request start (%@)", @(rid)];
  [self _sendRequest:method params:params attempt:1 maxAttempts:_retryMaxAttempts retryDelay:_retryDelay requestId:rid completion:^(NSError *error, id value) {
    if (replied) {
      //[self.logDelegate log:MPLogLevelVerbose format:@"Ignoring event, we already completed (%@)", @(requestId)];
      return;
    }

    replied = YES;
    //[self.logDelegate log:MPLogLevelVerbose format:@"Request completion (%@)", @(rid)];
    completion(error, value);
  }];
}

- (void)_sendRequest:(NSString *)method params:(NSArray *)params attempt:(NSInteger)attempt maxAttempts:(NSInteger)maxAttempts retryDelay:(NSTimeInterval)retryDelay requestId:(NSUInteger)requestId completion:(void (^)(NSError *error, id value))completion {

  if (attempt < 1) {
    completion(MPMakeError(-1, @"Invalid attempt number"), nil);
    return;
  }

  if (!_connection) {
    NSError *error = nil;
    if (![self connect:&error]) {
      if (attempt >= maxAttempts) {
        completion(error, nil);
        return;
      } else {
        [self.logDelegate log:MPLogLevelError format:@"Retrying connect after XPC connect (requestId=%@) error: %@", @(requestId), error];
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, retryDelay * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
          [self _sendRequest:method params:params attempt:attempt+1 maxAttempts:maxAttempts retryDelay:retryDelay requestId:requestId completion:completion];
        });
      }
    }
  }

  NSError *error = nil;
  xpc_object_t message = [MPXPCProtocol XPCObjectFromRequestWithMethod:method messageId:++_messageId params:params error:&error];
  if (!message) {
    completion(error, nil);
    return;
  }

  if (!_connection) {
    completion(MPMakeError(MPXPCErrorCodeInvalidConnection, @"No connection"), nil);
    return;
  }

  //[self.logDelegate log:MPLogLevelVerbose format:@"Sending request (%@)", @(requestId)];
  xpc_connection_send_message_with_reply(_connection, message, dispatch_get_main_queue(), ^(xpc_object_t event) {
    if (xpc_get_type(event) == XPC_TYPE_ERROR) {
      const char *description = xpc_dictionary_get_string(event, "XPCErrorDescription");
      NSString *errorMessage = [NSString stringWithCString:description encoding:NSUTF8StringEncoding];
      NSError *xpcError = MPMakeError(MPXPCErrorCodeInvalidConnection, @"XPC Error: %@", errorMessage);
      if (attempt >= maxAttempts) {
        [self.logDelegate log:MPLogLevelError format:@"Max attempts reached (%@ >= %@)", @(attempt), @(maxAttempts)];
        completion(xpcError, nil);
      } else {
        [self.logDelegate log:MPLogLevelError format:@"Retrying (attempt=%@, requestId=%@) after XPC error: %@", @(attempt), @(requestId), xpcError];
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, retryDelay * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
          [self _sendRequest:method params:params attempt:attempt+1 maxAttempts:maxAttempts retryDelay:retryDelay requestId:requestId completion:completion];
        });
      }
    } else if (xpc_get_type(event) == XPC_TYPE_DICTIONARY) {
      NSError *error = nil;
      size_t length = 0;
      const void *buffer = xpc_dictionary_get_data(event, "data", &length);
      NSData *dataResponse = [NSData dataWithBytes:buffer length:length];

      id response = [dataResponse mp_array:self.readOptions error:&error];

      if (!response) {
        completion(error, nil);
        return;
      }
      if (!MPVerifyResponse(response, &error)) {
        completion(error, nil);
        return;
      }
      NSDictionary *errorDict = MPIfNull(response[2], nil);
      if (errorDict) {
        error = MPErrorFromErrorDict(self.serviceName, errorDict);
        completion(error, nil);
      } else {
        completion(nil, MPIfNull(response[3], nil));
      }
    }
  });
}

@end
