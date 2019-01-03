//
//  MPDispatchRequest.h
//  MPMessagePack
//
//  Created by Gabriel on 10/14/15.
//  Copyright © 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface MPDispatchRequest : NSObject

@property (readonly) dispatch_semaphore_t semaphore;

@property NSError *error;
@property id result;

+ (instancetype)dispatchRequest;

@end