//
//  MPRPCProtocolTest.m
//  MPMessagePack
//
//  Created by Gabriel on 8/30/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <XCTest/XCTest.h>

#import <MPMessagePack/MPMessagePack.h>

@interface MPRPCProtocolTest : XCTestCase
@end

@implementation MPRPCProtocolTest

- (void)testRequestFramed {
  NSError *error = nil;
  MPRPCProtocol *protocol = [[MPRPCProtocol alloc] init];
  NSData *data = [protocol encodeRequestWithMethod:@"test" params:@[@{@"arg1": @"val1"}] messageId:1 options:0 framed:YES error:&error];
  XCTAssertNil(error);
  XCTAssertNotNil(data);

  NSError *error2 = nil;
  NSArray *message = [protocol decodeMessage:data framed:YES error:&error2];
  XCTAssertNil(error2);
  XCTAssertNotNil(message);
  XCTAssertEqualObjects(message[2], @"test");
}

- (void)testResponseFramed {
  NSError *error = nil;
  MPRPCProtocol *protocol = [[MPRPCProtocol alloc] init];
  NSData *data = [protocol encodeResponseWithResult:@(1) error:nil messageId:1 options:0 framed:YES encodeError:&error];
  XCTAssertNil(error);
  XCTAssertNotNil(data);

  NSArray *message = [protocol decodeMessage:data framed:YES error:&error];
  XCTAssertNil(error);
  XCTAssertNotNil(message);
}

@end
