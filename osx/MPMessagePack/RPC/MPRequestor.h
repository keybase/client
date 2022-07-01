//
//  MPRequestor.h
//  MPMessagePack
//
//  Created by Gabriel on 10/14/15.
//  Copyright © 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "MPRPCProtocol.h"

@interface MPRequestor : NSObject

@property (readonly) MPRequestCompletion completion;

+ (instancetype)requestWithCompletion:(MPRequestCompletion)completion;

- (void)completeWithResult:(id)result error:(NSError *)error;

@end
