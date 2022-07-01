//
//  MPMessagePackXPC.h
//  MPMessagePack
//
//  Created by Gabriel on 5/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <ServiceManagement/ServiceManagement.h>
#import <xpc/xpc.h>

@interface MPXPCService : NSObject

- (void)listen:(xpc_connection_t)service;

- (void)listen:(xpc_connection_t)service codeRequirement:(NSString *)codeRequirement;

// Subclasses should implement this
- (void)handleRequestWithMethod:(NSString *)method params:(NSArray *)params messageId:(NSNumber *)messageId remote:(xpc_connection_t)remote completion:(void (^)(NSError *error, id value))completion;

@end
