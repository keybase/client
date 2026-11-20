//
//  MPXPCClient.h
//  MPMessagePack
//
//  Created by Gabriel on 5/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "MPMessagePackReader.h"
#import "MPLog.h"

@interface MPXPCClient : NSObject

@property NSTimeInterval timeout;
@property NSInteger retryMaxAttempts;
@property NSTimeInterval retryDelay;
@property (weak) id<MPLog> logDelegate;

- (instancetype)initWithServiceName:(NSString *)serviceName privileged:(BOOL)privileged;

- (void)sendRequest:(NSString *)method params:(NSArray *)params completion:(void (^)(NSError *error, id value))completion;

@end
