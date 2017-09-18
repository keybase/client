// Copyright 2015 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build ignore

@import ObjectiveC.message;
@import Foundation;
@import XCTest;
@import Objcpkg;

@interface TestNSObject : NSObject

- (NSString *)description;
- (NSString *)super_description;

@end

@implementation TestNSObject

- (NSString *)description {
	return @"hej";
}

- (NSString *)super_description {
	return [super description];
}

@end

@interface wrappers : XCTestCase

@end

@implementation wrappers

- (void)setUp {
	[super setUp];
	// Put setup code here. This method is called before the invocation of each test method in the class.
}

- (void)tearDown {
	// Put teardown code here. This method is called after the invocation of each test method in the class.
	[super tearDown];
}

- (void)testFunction {
	ObjcpkgFunc();
}

- (void)testMethod {
	ObjcpkgMethod();
}

- (void)testNew {
	ObjcpkgNew();
}

- (void)testError {
	ObjcpkgError();
}

- (void)testClass {
	ObjcpkgGoNSDate *d = [[ObjcpkgGoNSDate alloc] init];
	NSString *desc = [d description];
	XCTAssertEqual(d, [d getSelf], "GoNSDate self not identical");
	XCTAssertEqual(ObjcpkgHash, [d hash], "GoNSDate hash not identical");
	XCTAssertTrue([desc isEqualToString:ObjcpkgDescriptionStr], "GoNSDate description mismatch: %@", desc);
	ObjcpkgGoUIResponder *resp = [[ObjcpkgGoUIResponder alloc] init];
	[resp pressesBegan:nil withEvent:nil];
	XCTAssertTrue([resp called], "GoUIResponder.pressesBegan not called");
}

- (void)testSuper {
	ObjcpkgGoNSObject *o = [[ObjcpkgGoNSObject alloc] init];
	struct objc_super _super = {
		.receiver = o,
		.super_class = [NSObject class],
	};
	NSString *superDesc = ((NSString *(*)(struct objc_super*, SEL))objc_msgSendSuper)(&_super, @selector(description));
	XCTAssertTrue([superDesc isEqualToString:[o description]], "GoNSObject description mismatch");
	[o setUseSelf:TRUE];
	XCTAssertTrue([ObjcpkgDescriptionStr isEqualToString:[o description]], "GoNSObject description mismatch");
}

- (void)testIdentity {
	NSDate *d = [[NSDate alloc] init];
	NSDate *d2 = ObjcpkgDupNSDate(d);
	XCTAssertEqual(d, d2, @"ObjcpkgDupNSDate failed to duplicate ObjC instance");
	ObjcpkgGoNSDate *gd = [[ObjcpkgGoNSDate alloc] init];
	NSDate *gd2 = ObjcpkgDupNSDate(gd);
	XCTAssertEqual(gd, gd2, @"ObjcpkgDupNSDate failed to duplicate Go instance");
	NSDate *gd3 = ObjcpkgNewGoNSDate();
	NSDate *gd4 = ObjcpkgDupNSDate(gd3);
	XCTAssertEqual(gd4, gd3, @"ObjcpkgDupNSDate failed to duplicate instance created in Go");
}
@end
