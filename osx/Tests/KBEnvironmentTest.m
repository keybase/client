//
//  KBEnvironmentTest.m
//  Keybase
//
//  Created by Gabriel on 5/19/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Cocoa/Cocoa.h>
#import <XCTest/XCTest.h>

#import "KBEnvironment.h"

@interface KBEnvironmentTest : XCTestCase
@end

@implementation KBEnvironmentTest

- (void)testPlist {
  KBEnvironment *environment = [KBEnvironment env:KBEnvKeybaseIO];
  NSDictionary *plist = [environment launchdPlistDictionaryForService];
  XCTAssertNotNil(plist);
  NSDictionary *plist2 = [environment launchdPlistDictionaryForKBFS];
  XCTAssertNotNil(plist2);
}

@end
