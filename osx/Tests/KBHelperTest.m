//
//  KBHelperTest.m
//  Keybase
//
//  Created by Gabriel on 4/21/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <XCTest/XCTest.h>

#import "KBHelper.h"
#import "KBHelperClient.h"

@interface KBHelperTest : XCTestCase
@end

@implementation KBHelperTest

- (void)testXPC {
  XCTestExpectation *expectation = [self expectationWithDescription:@"Handle event"];


  KBHelperClient *helperClient = [[KBHelperClient alloc] init];
  KBHelper *helper = [[KBHelper alloc] init];

  xpc_object_t event = [helperClient XPCObjectForRequestWithMethod:@"version" params:nil error:nil];
  XTCAssertNotNil(event);
  [helper handleEvent:event completion:^(xpc_object_t reply) {
    NSArray *response = [helperClient responseForXPCObject:reply error:nil];
    DDLogDebug(@"Response: %@", response);
    [expectation fulfill];
  }];

  [self waitForExpectationsWithTimeout:1.0 handler:^(NSError *error) {

  }];
}

@end

