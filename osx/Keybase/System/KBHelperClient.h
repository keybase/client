//
//  KBHelperClient.h
//  Keybase
//
//  Created by Gabriel on 4/16/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBDefines.h"

@interface KBHelperClient : NSObject

- (BOOL)connect:(NSError **)error;

- (BOOL)install:(NSError **)error;

- (void)sendRequest:(NSString *)method params:(NSArray *)params completion:(void (^)(NSError *error, NSArray *response))completion;


- (xpc_object_t)XPCObjectForRequestWithMethod:(NSString *)method params:(NSArray *)params error:(NSError **)error;

- (NSArray *)responseForData:(NSData *)data error:(NSError **)error;

@end
