//
//  KBHelperTest.m
//  Keybase
//
//  Created by Gabriel on 4/21/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBHelper.h"
#import "KBHelperClient.h"

@interface KBHelperTest : NSObject
@end

@implementation KBHelperTest

- (void)test:(dispatch_block_t)completion {
  KBHelperClient *helperClient = [[KBHelperClient alloc] init];
  KBHelper *helper = [[KBHelper alloc] init];

  xpc_object_t event = [helperClient XPCObjectForRequestWithMethod:@"version" params:nil error:nil];
  GRAssertNotNil(event);
  [helper handleEvent:event completion:^(xpc_object_t reply) {
    NSArray *response = [helperClient responseForXPCObject:reply error:nil];
    GRTestLog(@"Response: %@", response);
    completion();
  }];
}

@end

