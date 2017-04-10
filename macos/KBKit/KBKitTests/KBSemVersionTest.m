//
//  KBSemVersionTest.m
//  Keybase
//
//  Created by Gabriel on 8/21/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import <Cocoa/Cocoa.h>
#import <XCTest/XCTest.h>

#import <KBKit/KBSemVersion.h>

@interface KBSemVersionTest : XCTestCase
@end

@implementation KBSemVersionTest

- (void)test {
  KBSemVersion *version = [KBSemVersion version:@"1.2.3-400"];
  XCTAssertEqualObjects(version.version, @"1.2.3");
  XCTAssertEqualObjects(version.build, @"400");
  XCTAssertEqual(version.major, 1);
  XCTAssertEqual(version.minor, 2);
  XCTAssertEqual(version.patch, 3);
  XCTAssertEqual([version.build integerValue], 400);

  KBSemVersion *version2 = [KBSemVersion version:@"1.2.3-401"];
  XCTAssertTrue([version2 isGreaterThan:version]);

  KBSemVersion *version3 = [KBSemVersion version:@"1.2.4-401"];
  XCTAssertTrue([version3 isGreaterThan:version2]);

  KBSemVersion *version4 = [KBSemVersion version:@"1.2.4-402b"];
  XCTAssertTrue([version4 isGreaterThan:version3]);
}

- (void)testBuildWithDash {
  KBSemVersion *version = [KBSemVersion version:@"1.2.3-400-abc"];
  XCTAssertEqualObjects(version.version, @"1.2.3");
  XCTAssertEqualObjects(version.build, @"400-abc");
}

- (void)testNoBuild {
  KBSemVersion *version = [KBSemVersion version:@"1.2.3"];
  XCTAssertEqualObjects(version.version, @"1.2.3");
  XCTAssertNil(version.build);
}

- (void)testSameBuild {
  KBSemVersion *version = [KBSemVersion version:@"1.2.3-1.2.3"];
  XCTAssertEqualObjects(version.version, @"1.2.3");
  XCTAssertNil(version.build);

  KBSemVersion *version2 = [KBSemVersion version:@"1.2.3"];
  XCTAssertTrue([version2 isOrderedSame:version]);
}

- (void)testEmptyBuild {
  KBSemVersion *version = [KBSemVersion version:@"1.2.3-"];
  XCTAssertEqualObjects(version.version, @"1.2.3");
  XCTAssertNil(version.build);
}

- (void)testStrip {
  KBSemVersion *version = [KBSemVersion version:@" 1.2.3 - 401 "];
  XCTAssertEqualObjects(version.version, @"1.2.3");
  XCTAssertEqualObjects(version.build, @"401");
}

@end
