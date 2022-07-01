//
//  MPRPCProtocol.m
//  MPMessagePack
//
//  Created by Gabriel on 8/30/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "MPRPCProtocol.h"
#import "MPDefines.h"

NSString *const MPErrorInfoKey = @"MPErrorInfoKey";

@implementation MPRPCProtocol

- (NSData *)_frameData:(NSData *)data {
  NSError *error = nil;
  NSData *frameSize = [MPMessagePackWriter writeObject:@(data.length) options:0 error:&error];
  NSAssert(frameSize, @"Error packing frame size: %@", error);

  NSMutableData *framedData = [NSMutableData dataWithCapacity:data.length + frameSize.length];
  [framedData appendData:frameSize];
  [framedData appendData:data];
  return framedData;
}

- (NSData *)encodeRequestWithMethod:(NSString *)method params:(NSArray *)params messageId:(NSInteger)messageId options:(MPMessagePackWriterOptions)options framed:(BOOL)framed error:(NSError **)error {
  NSArray *request = @[@(0), @(messageId), method, params ? params : NSNull.null];
  NSData *data = [MPMessagePackWriter writeObject:request options:options error:error];

  if (!data) {
    return nil;
  }
  
  return framed ? [self _frameData:data] : data;
}

- (NSData *)encodeResponseWithResult:(id)result error:(id)error messageId:(NSInteger)messageId options:(MPMessagePackWriterOptions)options framed:(BOOL)framed encodeError:(NSError **)encodeError {
  NSArray *response = @[@(1), @(messageId), error ? error : NSNull.null, result ? result : NSNull.null];
  NSData *data = [MPMessagePackWriter writeObject:response options:options error:encodeError];
  
  if (!data) {
    return nil;
  }
  
  return framed ? [self _frameData:data] : data;
}

- (NSArray *)decodeMessage:(NSData *)data framed:(BOOL)framed error:(NSError **)error {
  MPMessagePackReader *reader = [[MPMessagePackReader alloc] initWithData:data];

  if (framed) {
    NSNumber *frameSize = [reader readObject:error];
    if (![frameSize isKindOfClass:NSNumber.class] || *error) {
      if (!error) *error = MPMakeError(-1, @"Invalid frame");
      return nil;
    }
  }

  id<NSObject> obj = [reader readObject:error];
  if (!obj || *error) {
    if (!error) *error = MPMakeError(-1, @"Invalid object");
    return nil;
  }

  if (!MPVerifyMessage(obj, error)) {
    if (!error) *error = MPMakeError(-1, @"Invalid message");
    return nil;
  }

  NSArray *message = (NSArray *)obj;
  return message;
}

@end

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
  return [NSError errorWithDomain:domain code:code userInfo:@{NSLocalizedDescriptionKey: desc, MPErrorInfoKey: dict}];
}
