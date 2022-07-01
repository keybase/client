//
//  MPDispatchRequest.m
//  MPMessagePack
//
//  Created by Gabriel on 10/14/15.
//  Copyright © 2015 Gabriel Handford. All rights reserved.
//

#import "MPDispatchRequest.h"

@interface MPDispatchRequest ()
@property dispatch_semaphore_t semaphore;
@end

@implementation  MPDispatchRequest

+ (instancetype)dispatchRequest {
  MPDispatchRequest *request = [[MPDispatchRequest alloc] init];
  request.semaphore = dispatch_semaphore_create(0);
  return request;
}

- (void)completeWithResult:(id)result error:(NSError *)error {
  _result = result;
  if (!_error) _error = error;
}

@end
