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
  MPRPCErrorRequestInvalid = -20,
};

// Verify the object is a valid msgpack rpc message
BOOL MPVerifyMessage(id request, NSError **error);

// Verify the object is a valid msgpack rpc request
BOOL MPVerifyRequest(NSArray *request, NSError **error);

// Verify the object is a valid msgpack rpc response
BOOL MPVerifyResponse(NSArray *response, NSError **error);

// NSError from error dict
NSError *MPErrorFromErrorDict(NSString *domain, NSDictionary *dict);
