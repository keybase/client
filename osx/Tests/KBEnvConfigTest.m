//
//  KBEnvironmentTest.m
//  Keybase
//
//  Created by Gabriel on 5/19/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Cocoa/Cocoa.h>
#import <XCTest/XCTest.h>

#import "KBEnvConfig.h"

@interface KBEnvConfigTest : XCTestCase
@end

@implementation KBEnvConfigTest

- (void)testPlist {
  KBEnvConfig *config = [KBEnvConfig env:KBEnvKeybaseIO];
  NSDictionary *plist = [config launchdPlistDictionaryForService];
  XCTAssertNotNil(plist);
  NSDictionary *plist2 = [config launchdPlistDictionaryForKBFS];
  XCTAssertNotNil(plist2);
}

@end
