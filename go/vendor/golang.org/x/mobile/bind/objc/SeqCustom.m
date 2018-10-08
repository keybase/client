// Copyright 2018 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build ignore

#import <Foundation/Foundation.h>
#import <XCTest/XCTest.h>
@import Testpkg;

@interface tests : XCTestCase

@end

@implementation tests

- (void)testBasics {
	CustomTestpkgHi();
}

@end
