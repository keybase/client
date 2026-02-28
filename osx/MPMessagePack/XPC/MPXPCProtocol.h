//
//  MPXPCProtocol.h
//  MPMessagePack
//
//  Created by Gabriel on 5/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <xpc/xpc.h>

typedef NS_ENUM(NSInteger, MPXPCErrorCode) {
  MPXPCErrorCodeNone = 0,
  MPXPCErrorCodeInvalidRequest = -1,
  MPXPCErrorCodeUnknownRequest = -2,

  MPXPCErrorCodeInvalidConnection = -10,
  MPXPCErrorCodeTimeout = -11,
};

@interface MPXPCProtocol : NSObject

+ (xpc_object_t)XPCObjectFromRequestWithMethod:(NSString *)method messageId:(NSInteger)messageId params:(NSArray *)params error:(NSError **)error;

+ (void)requestFromXPCObject:(xpc_object_t)event completion:(void (^)(NSError *error, NSNumber *messageId, NSString *method, NSArray *params))completion;

@end
