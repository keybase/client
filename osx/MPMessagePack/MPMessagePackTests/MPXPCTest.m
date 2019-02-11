//
//  MPXPCTest.m
//  MPMessagePack
//
//  Created by Gabriel on 5/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <XCTest/XCTest.h>

#import <MPMessagePack/MPMessagePack.h>

@interface MPXPCTest : XCTestCase
@end

@interface MPXPCTestService : MPXPCService
@end

@implementation MPXPCTestService

- (void)handleRequestWithMethod:(NSString *)method params:(NSArray *)params messageId:(NSNumber *)messageId completion:(void (^)(NSError *error, id value))completion {
  if ([method isEqualToString:@"test"]) {
    completion(nil, @"ok");
  } else {
    completion(MPMakeError(MPXPCErrorCodeUnknownRequest, @"Unkown request"), nil);
  }
}

@end

@implementation MPXPCTest

- (void)testXpc {
  XCTestExpectation *expectation = [self expectationWithDescription:@"Handle event"];

  MPXPCTestService *service = [[MPXPCTestService alloc] init];

  // TODO real test
  [service handleRequestWithMethod:@"test" params:nil messageId:@(1) completion:^(NSError *error, id value) {
    XCTAssertEqualObjects(@"ok", value);
    [expectation fulfill];
  }];

  [self waitForExpectationsWithTimeout:1.0 handler:nil];
}

- (void)testInvalidConnection {
  XCTestExpectation *expectation = [self expectationWithDescription:@"Timeout"];
  MPXPCClient *client = [[MPXPCClient alloc] initWithServiceName:@"Test" privileged:YES];
  [client sendRequest:@"test" params:nil completion:^(NSError *error, id value) {
    XCTAssertEqual(error.code, MPXPCErrorCodeInvalidConnection);
    [expectation fulfill];
  }];

  [self waitForExpectationsWithTimeout:1.0 handler:nil];
}

@end

