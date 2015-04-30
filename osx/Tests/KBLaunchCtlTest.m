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
#import "KBLaunchCtl.h"

@interface KBLaunchCtlTest : XCTestCase
@end

@implementation KBLaunchCtlTest

- (void)testPlist {
  KBEnvironment *environment = [KBEnvironment env:KBEnvKeybaseIO];
  NSString *plist = [KBLaunchCtl launchdPlistForEnvironment:environment error:nil];
  DDLogDebug(@"Plist: %@", plist);
  XCTAssertNotNil(plist);
}

@end