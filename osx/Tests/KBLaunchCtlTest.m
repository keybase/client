//
//  KBLaunchCtlTest.m
//  Keybase
//
//  Created by Gabriel on 4/29/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <XCTest/XCTest.h>

#import "KBEnvironment.h"
#import "KBHelperDefines.h"

@interface KBLaunchCtlTest : XCTestCase
@end

@implementation KBLaunchCtlTest

- (void)testPlist {
  KBEnvironment *environment = [KBEnvironment env:KBEnvKeybaseIO];
  NSDictionary *plist = [environment launchdPlistDictionaryForService];
  XCTAssertNotNil(plist);
}

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