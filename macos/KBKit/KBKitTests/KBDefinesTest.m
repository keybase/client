//
//  KBDefinesTest.m
//  Keybase
//
//  Created by Gabriel on 5/19/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Cocoa/Cocoa.h>
#import <XCTest/XCTest.h>

#import <KBKit/KBDefines.h>

@interface KBDefinesTest : XCTestCase
@end

@implementation KBDefinesTest

- (void)testNumberFromString {
  XCTAssertNil(KBNumberFromString(@"-"));
  XCTAssertNil(KBNumberFromString(@""));
  XCTAssertNil(KBNumberFromString(@" "));

  XCTAssertEqualObjects(KBNumberFromString(@"-1"), [NSNumber numberWithInteger:-1]);
  XCTAssertEqualObjects(KBNumberFromString(@"0"), [NSNumber numberWithInteger:0]);
  XCTAssertEqualObjects(KBNumberFromString(@"1"), [NSNumber numberWithInteger:1]);
  XCTAssertEqualObjects(KBNumberFromString(@"\t 1 "), [NSNumber numberWithInteger:1]);
}

@end
