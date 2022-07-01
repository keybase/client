//
//  MPMessagePack
//
//  Created by Gabriel on 5/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <XCTest/XCTestCase.h>

#import <MPMessagePack/MPMessagePack.h>

@interface MPMessagePackClientTest : XCTestCase
@property MPMessagePackClient *client;
@property MPMessagePackServer *server;
@end

@implementation MPMessagePackClientTest

- (void)testClientServer {
  MPMessagePackServer *server = [[MPMessagePackServer alloc] initWithOptions:MPMessagePackOptionsFramed];
  
  server.requestHandler = ^(NSNumber *messageId, NSString *method, id params, MPRequestCompletion requestCompletion) {
    if ([method isEqualToString:@"test"]) {
      requestCompletion(nil, params);
    }
  };
  
  UInt32 port = 41112;
  NSError *error = nil;
  
  if (![server openWithPort:port error:&error]) {
    XCTFail(@"Unable to start server: %@", error);
  }

  XCTestExpectation *openExpectation = [self expectationWithDescription:@"Open"];
  MPMessagePackClient *client = [[MPMessagePackClient alloc] initWithName:@"Test" options:MPMessagePackOptionsFramed];
  [client openWithHost:@"localhost" port:port completion:^(NSError *error) {
    XCTAssertNil(error);
    [openExpectation fulfill];
  }];

  [self waitForExpectationsWithTimeout:10.0 handler:nil];

  XCTestExpectation *requestExpectation1 = [self expectationWithDescription:@"Request 1"];
  NSLog(@"Sending request");
  [client sendRequestWithMethod:@"test" params:@[@{@"arg": @(1)}] messageId:1 completion:^(NSError *error, id result) {
    NSLog(@"Result 1: %@", result);
    XCTAssertNotNil(result);
    [requestExpectation1 fulfill];
  }];

  [self waitForExpectationsWithTimeout:10.0 handler:nil];

  XCTestExpectation *requestExpectation2 = [self expectationWithDescription:@"Request 2"];
  dispatch_queue_t queue = dispatch_queue_create("testQueue", NULL);
  dispatch_async(queue, ^{
    NSError *error2 = nil;
    NSArray *params2 = @[@{@"arg": @(2)}];
    id result2 = [client sendRequestWithMethod:@"test" params:params2 messageId:2 timeout:2 error:&error2];
    NSLog(@"Result 2: %@", result2);

    XCTAssertNil(error2);
    XCTAssertNotNil(result2);
    XCTAssertEqualObjects(params2, result2);
    [requestExpectation2 fulfill];
  });

  [self waitForExpectationsWithTimeout:10.0 handler:nil];

  // Timeout
  XCTestExpectation *requestExpectation3 = [self expectationWithDescription:@"Request 3"];
  dispatch_async(queue, ^{
    NSError *error3 = nil;
    NSLog(@"Request 3");
    id result3 = [client sendRequestWithMethod:@"testTimeout" params:@[] messageId:3 timeout:0.5 error:&error3];
    XCTAssertNil(result3);
    XCTAssertNotNil(error3);
    XCTAssertEqual(error3.code, MPRPCErrorRequestTimeout);
    [requestExpectation3 fulfill];
  });

  [self waitForExpectationsWithTimeout:10.0 handler:nil];

  // Cancel
  XCTestExpectation *requestExpectation4 = [self expectationWithDescription:@"Request 4"];
  dispatch_async(queue, ^{
    NSError *error4 = nil;
    NSLog(@"Request 4");
    id result4 = [client sendRequestWithMethod:@"testCancel" params:@[] messageId:4 timeout:2 error:&error4];
    XCTAssertNil(result4);
    XCTAssertNotNil(error4);
    XCTAssertEqual(error4.code, MPRPCErrorRequestCanceled);
    [requestExpectation4 fulfill];
  });
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    BOOL canceled = [client cancelRequestWithMessageId:4];
    NSLog(@"Canceled 4: %@", @(canceled));
    XCTAssertTrue(canceled);
  });

  [self waitForExpectationsWithTimeout:10.0 handler:nil];

  // Cancel (completion)
  XCTestExpectation *requestExpectation5 = [self expectationWithDescription:@"Request 5"];
  NSLog(@"Request 5");
  [client sendRequestWithMethod:@"testCancelCompletion" params:@[] messageId:5 completion:^(NSError *error5, id result5) {
    XCTAssertNil(result5);
    XCTAssertNotNil(error5);
    XCTAssertEqual(error5.code, MPRPCErrorRequestCanceled);
    [requestExpectation5 fulfill];
  }];
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    BOOL canceled = [client cancelRequestWithMessageId:5];
    NSLog(@"Canceled 5: %@", @(canceled));
    XCTAssertTrue(canceled);
  });

  [self waitForExpectationsWithTimeout:10.0 handler:nil];

  [client close];
  [server close];
}

//- (void)testLocalSocket:(dispatch_block_t)completion {
//  XCTestExpectation *expectation = [self expectationWithDescription:@"Echo"];
//  MPMessagePackServer *server = [[MPMessagePackServer alloc] initWithOptions:MPMessagePackOptionsFramed];
//  server.requestHandler = ^(NSString *method, id params, MPRequestCompletion completion) {
//    completion(nil, @{});
//  };
//  
//  NSString *socketName = [NSString stringWithFormat:@"/tmp/msgpacktest-%@.socket", @(arc4random())];
//  NSError *error = nil;
//  if (![server openWithSocket:socketName error:&error]) {
//    XCTFail(@"Unable to start server: %@", error);
//  }
//  
//  MPMessagePackClient *client = [[MPMessagePackClient alloc] initWithName:@"Test" options:MPMessagePackOptionsFramed];
//  if (![client openWithSocket:socketName error:&error]) {
//    XCTFail(@"Unable to connect to local socket");
//  }
//  
//  NSLog(@"Sending request");
//  [client sendRequestWithMethod:@"test" params:@{} completion:^(NSError *error, id result) {
//    NSLog(@"Result: %@", result);
//    [client close];
//    [server close];
//    [expectation fulfill];
//  }];
//
//  [self waitForExpectationsWithTimeout:1.0 handler:nil];
//}

@end