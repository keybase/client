//
//  MPRPCProtocol.h
//  MPMessagePack
//
//  Created by Gabriel on 8/30/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "MPMessagePackWriter.h"
#import "MPMessagePackReader.h"

extern NSString *const MPErrorInfoKey;

typedef NS_ENUM (NSInteger, MPRPCError) {
  MPRPCErrorNone = 0,
  MPRPCErrorSocketCreateError = -3,
  MPRPCErrorSocketOpenError = -6,
  MPRPCErrorSocketOpenTimeout = -7,
  MPRPCErrorRequestInvalid = -20,
  MPRPCErrorRequestTimeout = -21,
  MPRPCErrorRequestCanceled = -22,
  MPRPCErrorResponseInvalid = -30,
};

typedef void (^MPErrorHandler)(NSError *error);
// Callback after we send request
typedef void (^MPRequestCompletion)(NSError *error, id result);
typedef void (^MPRequestHandler)(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion);


@interface MPRPCProtocol : NSObject

- (NSData *)encodeRequestWithMethod:(NSString *)method params:(NSArray *)params messageId:(NSInteger)messageId options:(MPMessagePackWriterOptions)options framed:(BOOL)framed error:(NSError **)error;

- (NSData *)encodeResponseWithResult:(id)result error:(id)error messageId:(NSInteger)messageId options:(MPMessagePackWriterOptions)options framed:(BOOL)framed encodeError:(NSError **)encodeError;

- (NSArray *)decodeMessage:(NSData *)data framed:(BOOL)framed error:(NSError **)error;

@end


// Verify the object is a valid msgpack rpc message
BOOL MPVerifyMessage(id request, NSError **error);

// Verify the object is a valid msgpack rpc request
BOOL MPVerifyRequest(NSArray *request, NSError **error);

// Verify the object is a valid msgpack rpc response
BOOL MPVerifyResponse(NSArray *response, NSError **error);

// NSError from error dict
NSError *MPErrorFromErrorDict(NSString *domain, NSDictionary *dict);
