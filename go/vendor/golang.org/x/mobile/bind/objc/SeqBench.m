// Copyright 2015 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build ignore

#import <Foundation/Foundation.h>
#import <XCTest/XCTest.h>
#import "benchmark/Benchmark.h"

@interface AnI : NSObject <BenchmarkI> {
}
@end

@implementation AnI
- (void)f {
}
@end

@interface Benchmarks : NSObject <BenchmarkBenchmarks> {
}
@end

@implementation Benchmarks
- (void)manyargs:(long)p0 p1:(long)p1 p2:(long)p2 p3:(long)p3 p4:(long)p4 p5:(long)p5 p6:(long)p6 p7:(long)p7 p8:(long)p8 p9:(long)p9 {
}

- (id<BenchmarkI>)newI {
	return [[AnI alloc] init];
}

- (void)noargs {
}

- (void)onearg:(long)p0 {
}

- (long)oneret {
	return 0;
}

- (void)ref:(id<BenchmarkI>)p0 {
}

- (void)slice:(NSData*)p0 {
}

- (void)string:(NSString*)p0 {
}

- (NSString*)stringRetLong {
	return BenchmarkLongString;
}

- (NSString*)stringRetShort {
	return BenchmarkShortString;
}

- (void (^)(void))lookupBenchmark:(NSString *)name {
	if ([name isEqualToString:@"Empty"]) {
		return ^() {
		};
	} else if ([name isEqualToString:@"Noargs"]) {
		return ^() {
			BenchmarkNoargs();
		};
	} else if ([name isEqualToString:@"Onearg"]) {
		return ^() {
			BenchmarkOnearg(0);
		};
	} else if ([name isEqualToString:@"Manyargs"]) {
		return ^() {
			BenchmarkManyargs(0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
		};
	} else if ([name isEqualToString:@"Oneret"]) {
		return ^() {
			BenchmarkOneret();
		};
	} else if ([name isEqualToString:@"Refforeign"]) {
		id<BenchmarkI> objcRef = [[AnI alloc] init];
		return ^() {
			BenchmarkRef(objcRef);
		};
	} else if ([name isEqualToString:@"Refgo"]) {
		id<BenchmarkI> goRef = BenchmarkNewI();
		return ^() {
			BenchmarkRef(goRef);
		};
	} else if ([name isEqualToString:@"StringShort"]) {
		return ^() {
			BenchmarkString(BenchmarkShortString);
		};
	} else if ([name isEqualToString:@"StringLong"]) {
		return ^() {
			BenchmarkString(BenchmarkLongString);
		};
	} else if ([name isEqualToString:@"StringShortUnicode"]) {
		return ^() {
			BenchmarkString(BenchmarkShortStringUnicode);
		};
	} else if ([name isEqualToString:@"StringLongUnicode"]) {
		return ^() {
			BenchmarkString(BenchmarkLongStringUnicode);
		};
	} else if ([name isEqualToString:@"StringRetShort"]) {
		return ^() {
			BenchmarkStringRetShort();
		};
	} else if ([name isEqualToString:@"StringRetLong"]) {
		return ^() {
			BenchmarkStringRetLong();
		};
	} else if ([name isEqualToString:@"SliceShort"]) {
		NSData *s = [Benchmark shortSlice];
		return ^() {
			BenchmarkSlice(s);
		};
	} else if ([name isEqualToString:@"SliceLong"]) {
		NSData *s = [Benchmark longSlice];
		return ^() {
			BenchmarkSlice(s);
		};
	} else {
		return nil;
	}
}

- (void)run:(NSString*)name n:(long)n {
	void (^bench)(void) = [self lookupBenchmark:name];
	if (bench == nil) {
		NSLog(@"Error: no such benchmark: %@", name);
		return;
	}
	for (int i = 0; i < n; i++) {
		bench();
	}
}

- (void)runDirect:(NSString*)name n:(long)n {
	void (^bench)(void) = [self lookupBenchmark:name];
	if (bench == nil) {
		NSLog(@"Error: no such benchmark: %@", name);
		return;
	}
	dispatch_sync(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
		for (int i = 0; i < n; i++) {
			bench();
		}
	});
}

@end

@interface benchmarks : XCTestCase

@end

@implementation benchmarks

- (void)setUp {
	[super setUp];

	// Put setup code here. This method is called before the invocation of each test method in the class.

	// In UI tests it is usually best to stop immediately when a failure occurs.
	self.continueAfterFailure = NO;
	// UI tests must launch the application that they test. Doing this in setup will make sure it happens for each test method.
	[[[XCUIApplication alloc] init] launch];

	// In UI tests it’s important to set the initial state - such as interface orientation - required for your tests before they run. The setUp method is a good place to do this.
}

- (void)tearDown {
	// Put teardown code here. This method is called after the invocation of each test method in the class.
	[super tearDown];
}

- (void)testBenchmark {
	// Long running unit tests seem to hang. Use an XCTestExpectation and run the Go
	// benchmark suite on a GCD thread.
	XCTestExpectation *expectation =
		[self expectationWithDescription:@"Benchmark"];

	dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
		Benchmarks *b = [[Benchmarks alloc] init];
		BenchmarkRunBenchmarks(b);
		[expectation fulfill];
	});

	[self waitForExpectationsWithTimeout:5*60.0 handler:^(NSError *error) {
		if (error) {
			NSLog(@"Timeout Error: %@", error);
		}
	}];
}
@end
