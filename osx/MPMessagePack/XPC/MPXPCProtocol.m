//
//  MPXPCProtocol.m
//  MPMessagePack
//
//  Created by Gabriel on 5/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "MPXPCProtocol.h"

#import "NSArray+MPMessagePack.h"
#import "NSData+MPMessagePack.h"
#import "MPRPCProtocol.h"
#import "MPDefines.h"

@implementation MPXPCProtocol

+ (xpc_object_t)XPCObjectFromRequestWithMethod:(NSString *)method messageId:(NSInteger)messageId params:(NSArray *)params error:(NSError **)error {
  NSArray *request = @[@(0), @(messageId), method, (params ? params : NSNull.null)];
  NSData *dataRequest = [request mp_messagePack:0 error:error];
  if (!dataRequest) {
    return nil;
  }

  // XPC request object must be dictionary so put data in {"data": data} dictionary.
  xpc_object_t message = xpc_dictionary_create(NULL, NULL, 0);
  xpc_dictionary_set_data(message, "data", [dataRequest bytes], [dataRequest length]);
  return message;
}

+ (void)requestFromXPCObject:(xpc_object_t)event completion:(void (^)(NSError *error, NSNumber *messageId, NSString *method, NSArray *params))completion {
  size_t length = 0;
  const void *buffer = xpc_dictionary_get_data(event, "data", &length);
  NSData *dataRequest = [NSData dataWithBytes:buffer length:length];

  NSError *error = nil;

  // See msgpack-rpc spec for request/response format
  NSArray *request = [dataRequest mp_array:&error];
  if (error) {
    completion(error, nil, nil, nil);
    return;
  }

  if (!MPVerifyRequest(request, &error)) {
    completion(error, nil, nil, nil);
    return;
  }

  NSNumber *messageId = request[1];
  NSString *method = request[2];
  NSArray *params = MPIfNull(request[3], @[]);

  completion(nil, messageId, method, params);
}

@end
