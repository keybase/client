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

// TODO: Fix
@interface KBHelperTest : XCTestCase
@end

@implementation KBHelperTest

- (void)testXpc {
  XCTestExpectation *expectation = [self expectationWithDescription:@"Handle version"];

  KBHelper *helper = [[KBHelper alloc] init];
  [helper handleRequestWithMethod:@"version" params:nil messageId:@(1) completion:^(NSError *error, id value) {
    //NSLog(@"value=%@", KBDescription(value));
    [expectation fulfill];
  }];

  [self waitForExpectationsWithTimeout:1.0 handler:nil];
}

@end

