//
//  MPRequestor.m
//  MPMessagePack
//
//  Created by Gabriel on 10/14/15.
//  Copyright © 2015 Gabriel Handford. All rights reserved.
//

#import "MPRequestor.h"

@interface MPRequestor ()
@property MPRequestCompletion completion;
@end

@implementation MPRequestor

+ (instancetype)requestWithCompletion:(MPRequestCompletion)completion {
  MPRequestor *request = [[MPRequestor alloc] init];
  request.completion = completion;
  return request;
}

- (void)completeWithResult:(id)result error:(NSError *)error {
  self.completion(error, result);
  self.completion = nil;
}

@end
