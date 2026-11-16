//
//  MPRPCProtocol.m
//  MPMessagePack
//
//  Created by Gabriel on 8/30/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "MPRPCProtocol.h"
#import "MPDefines.h"

BOOL MPVerifyMessage(id message, NSError **error) {
  if (![message isKindOfClass:NSArray.class]) {
    if (error) *error = MPMakeError(MPRPCErrorRequestInvalid, @"Invalid request; Not NSArray type");
    return NO;
  }

  if ([message count] != 4) {
    if (error) *error = MPMakeError(MPRPCErrorRequestInvalid, @"Invalid request; Request should have 4 elements");
    return NO;
  }

  id typeObj = MPIfNull(message[0], nil);
  if (!typeObj) {
    if (error) *error = MPMakeError(MPRPCErrorRequestInvalid, @"Invalid request; First element (type) can't be null");
    return NO;
  }
  if (![typeObj isKindOfClass:NSNumber.class]) {
    if (error) *error = MPMakeError(MPRPCErrorRequestInvalid, @"Invalid request; First element (type) is not a number");
    return NO;
  }

  id messageIdObj = MPIfNull(message[1], nil);
  if (!messageIdObj) {
    if (error) *error = MPMakeError(MPRPCErrorRequestInvalid, @"Invalid request; Second element (messageId) can't be null");
    return NO;
  }
  if (![messageIdObj isKindOfClass:NSNumber.class]) {
    if (error) *error = MPMakeError(MPRPCErrorRequestInvalid, @"Invalid request; Second element (messageId) is not a number");
    return NO;
  }

  return YES;
}

BOOL MPVerifyRequest(NSArray *request, NSError **error) {
  NSInteger type = [request[0] integerValue];
  if (type != 0) {
    if (error) *error = MPMakeError(MPRPCErrorRequestInvalid, @"Invalid request; First element (type) is not 0: %@", @(type)); // Request type=0
    return NO;
  }

  id methodObj = MPIfNull(request[2], nil);
  if (!methodObj) {
    if (error) *error = MPMakeError(MPRPCErrorRequestInvalid, @"Invalid request; Third element (method) can't be null");
    return NO;
  }
  if (![methodObj isKindOfClass:NSString.class]) {
    if (error) *error = MPMakeError(MPRPCErrorRequestInvalid, @"Invalid request; Third element (method) is not a string");
    return NO;
  }

  id paramsObj = MPIfNull(request[3], nil);
  if (paramsObj && ![paramsObj isKindOfClass:NSArray.class]) {
    if (error) *error = MPMakeError(MPRPCErrorRequestInvalid, @"Invalid request; Fourth element (params) is not an array");
    return NO;
  }

  return YES;
}

BOOL MPVerifyResponse(NSArray *response, NSError **error) {
  NSInteger type = [response[0] integerValue];
  if (type != 1) {
    if (error) *error = MPMakeError(MPRPCErrorRequestInvalid, @"Invalid response; First element (type) is not 1"); // Request type=1
    return NO;
  }

  id messageIdObj = MPIfNull(response[1], nil);
  if (!messageIdObj) {
    if (error) *error = MPMakeError(MPRPCErrorRequestInvalid, @"Invalid response; Second element (messageId) can't be null");
    return NO;
  }
  if (![messageIdObj isKindOfClass:NSNumber.class]) {
    if (error) *error = MPMakeError(MPRPCErrorRequestInvalid, @"Invalid response; Second element (messageId) is not a number");
    return NO;
  }

  id errorObj = MPIfNull(response[2], nil);
  if (errorObj && ![errorObj isKindOfClass:NSDictionary.class]) {
    if (error) *error = MPMakeError(MPRPCErrorRequestInvalid, @"Invalid response; Third element (error) is not a dictionary");
    return NO;
  }

  return YES;
}

NSError *MPErrorFromErrorDict(NSString *domain, NSDictionary *dict) {
  NSInteger code = -1;
  if (dict[@"code"]) code = [dict[@"code"] integerValue];
  NSString *desc = @"Oops, something wen't wrong";
  if (dict[@"desc"]) desc = [dict[@"desc"] description];
  return [NSError errorWithDomain:domain code:code userInfo:@{NSLocalizedDescriptionKey: desc}];
}
