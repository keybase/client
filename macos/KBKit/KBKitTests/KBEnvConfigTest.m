//
//  KBEnvironmentTest.m
//  Keybase
//
//  Created by Gabriel on 5/19/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Cocoa/Cocoa.h>
#import <XCTest/XCTest.h>

#import <KBKit/KBEnvConfig.h>

@interface KBEnvConfigTest : XCTestCase
@end

@implementation KBEnvConfigTest

- (void)test {
  KBEnvConfig *config = [KBEnvConfig envConfigWithRunMode:KBRunModeProd];
  // TODO
  XCTAssertNotNil(config);
}

@end
