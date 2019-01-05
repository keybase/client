// Copyright 2015 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build ignore

#import <Foundation/Foundation.h>
#import <XCTest/XCTest.h>
#import "testpkg/Testpkg.h"

// Objective-C implementation of testpkg.I2.
@interface Number : NSObject <TestpkgI2> {
}
@property int32_t value;

// TODO(hyangah): error:error is not good.
- (BOOL)error:(BOOL)e error:(NSError **)error;
- (int64_t)times:(int32_t)v;
@end

// numI is incremented when the first numI objective-C implementation is
// deallocated.
static int numI = 0;

@implementation Number {
}
@synthesize value;

- (NSString *)stringError:(NSString *)s
              error:(NSError **)error {
   if ([s isEqualToString:@"number"]) {
       return @"OK";
   }
   *error = [NSError errorWithDomain:@"SeqTest" code:1 userInfo:@{NSLocalizedDescriptionKey: @"NumberError"}];
   return NULL;
}

- (BOOL)error:(BOOL)triggerError error:(NSError **)error {
    if (!triggerError) {
        return YES;
    }
    if (error != NULL) {
        *error = [NSError errorWithDomain:@"SeqTest" code:1 userInfo:NULL];
    }
    return NO;
}

- (int64_t)times:(int32_t)v {
    return v * value;
}

- (void)dealloc {
    if (self.value == 0) {
        numI++;
    }
}
@end

// Objective-C implementation of testpkg.NullTest.
@interface NullTest : NSObject <TestpkgNullTest> {
}

- (TestpkgNullTest *)null;
@end

@implementation NullTest {
}

- (TestpkgNullTest *)null {
  return nil;
}
@end

// Objective-C implementation of testpkg.InterfaceDupper.
@interface IDup : NSObject <TestpkgInterfaceDupper> {
}

@end

@implementation IDup {
}

- (id<TestpkgInterface>)iDup:(id<TestpkgInterface>)i {
  return i;
}
@end

// Objective-C implementation of testpkg.ConcreteDupper.
@interface CDup : NSObject <TestpkgConcreteDupper> {
}

@end

@implementation CDup {
}

- (TestpkgConcrete *)cDup:(TestpkgConcrete *)c {
  return c;
}
@end

// Objective-C implementation of testpkg.EmptyThrower.
@interface EmptyErrorer: NSObject <TestpkgEmptyErrorer> {
}

@end

@implementation EmptyErrorer {
}

- (BOOL)emptyError:(NSError **)error {
	*error = [NSError errorWithDomain:@"SeqTest" code:1 userInfo:NULL];
	return NO;
}
@end

@interface tests : XCTestCase

@end

@implementation tests

- (void)setUp {
	[super setUp];
}

- (void)tearDown {
	[super tearDown];
}

- (void)testBasics {
	TestpkgHi();

	TestpkgInt(42);
}

- (void)testAdd {
	int64_t sum = TestpkgAdd(31, 21);
	XCTAssertEqual(sum, 52, @"TestpkgSum(31, 21) = %lld, want 52\n", sum);
}

- (void)testHello:(NSString *)input {
	NSString *got = TestpkgAppendHello(input);
	NSString *want = [NSString stringWithFormat:@"Hello, %@!", input];
	XCTAssertEqualObjects(got, want, @"want %@\nTestpkgHello(%@)= %@", want, input, got);
}

- (void)testHellos {
	[self testHello:@"세계"]; // korean, utf-8, world.
	unichar t[] = {
		0xD83D, 0xDCA9,
	}; // utf-16, pile of poo.
	[self testHello:[NSString stringWithCharacters:t length:2]];
}

- (void)testString {
	NSString *input = @"";
	NSString *got = TestpkgStrDup(input);
	XCTAssertEqualObjects(got, input, @"want %@\nTestpkgEcho(%@)= %@", input, input, got);

	input = @"FOO";
	got = TestpkgStrDup(input);
	XCTAssertEqualObjects(got, input, @"want %@\nTestpkgEcho(%@)= %@", input, input, got);
}

- (void)testStruct {
	TestpkgS2 *s = TestpkgNewS2(10.0, 100.0);
	XCTAssertNotNil(s, @"TestpkgNewS2 returned NULL");

	double x = [s x];
	double y = [s y];
	double sum = [s sum];
	XCTAssertTrue(x == 10.0 && y == 100.0 && sum == 110.0,
			@"TestpkgS2(10.0, 100.0).X=%f Y=%f SUM=%f; want 10, 100, 110", x, y, sum);

	double sum2 = TestpkgCallSSum(s);
	XCTAssertEqual(sum, sum2, @"TestpkgCallSSum(s)=%f; want %f as returned by s.Sum", sum2, sum);

	[s setX:7];
	[s setY:70];
	x = [s x];
	y = [s y];
	sum = [s sum];
	XCTAssertTrue(x == 7 && y == 70 && sum == 77,
		@"TestpkgS2(7, 70).X=%f Y=%f SUM=%f; want 7, 70, 77", x, y, sum);

	NSString *first = @"trytwotested";
	NSString *second = @"test";
	NSString *got = [s tryTwoStrings:first second:second];
	NSString *want = [first stringByAppendingString:second];
	XCTAssertEqualObjects(got, want, @"TestpkgS_TryTwoStrings(%@, %@)= %@; want %@", first, second, got, want);
}

- (void)testCollectS {
	@autoreleasepool {
		[self testStruct];
	}

	TestpkgGC();
	long numS = TestpkgCollectS2(
		1, 10); // within 10 seconds, collect the S used in testStruct.
	XCTAssertEqual(numS, 1, @"%ld S objects were collected; S used in testStruct is supposed to "
		@"be collected.",
		numS);
}
- (void)testBytesAppend {
	NSString *a = @"Foo";
	NSString *b = @"Bar";
	NSData *data_a = [a dataUsingEncoding:NSUTF8StringEncoding];
	NSData *data_b = [b dataUsingEncoding:NSUTF8StringEncoding];
	NSData *gotData = TestpkgBytesAppend(data_a, data_b);
	NSString *got = [[NSString alloc] initWithData:gotData encoding:NSUTF8StringEncoding];
	NSString *want = [a stringByAppendingString:b];
	XCTAssertEqualObjects(got, want, @"want %@\nTestpkgBytesAppend(%@, %@) = %@", want, a, b, got);
}

- (void)testInterface {
	// Test Go object implementing testpkg.I is handled correctly.
	id<TestpkgI2> goObj = TestpkgNewI();
	int64_t got = [goObj times:10];
	XCTAssertEqual(got, 100, @"TestpkgNewI().times(10) = %lld; want %d", got, 100);
	int32_t key = -1;
	TestpkgRegisterI(key, goObj);
	int64_t got2 = TestpkgMultiply(key, 10);
	XCTAssertEqual(got, got2, @"TestpkgMultiply(10 * 10) = %lld; want %lld", got2, got);
	TestpkgUnregisterI(key);

	// Test Objective-C objects implementing testpkg.I is handled correctly.
	@autoreleasepool {
		for (int32_t i = 0; i < 10; i++) {
			Number *num = [[Number alloc] init];
			num.value = i;
			TestpkgRegisterI(i, num);
		}
		TestpkgGC();
	}

	// Registered Objective-C objects are pinned on Go side which must
	// prevent deallocation from Objective-C.
	for (int32_t i = 0; i < 10; i++) {
		int64_t got = TestpkgMultiply(i, 2);
		XCTAssertEqual(got, i * 2,@"TestpkgMultiply(%d, 2) = %lld; want %d", i, got, i * 2);
		TestpkgUnregisterI(i);
		TestpkgGC();
	}
	// Unregistered all Objective-C objects.
}

- (void)testCollectI {
	@autoreleasepool {
		[self testInterface];
	}
	XCTAssertEqual(numI, 1, @"%d I objects were collected; I used in testInterface is supposed "
		@"to be collected.", numI);
}

- (void)testConst {
	XCTAssertEqualObjects(TestpkgAString, @"a string", @"TestpkgAString = %@, want 'a string'", TestpkgAString);
	XCTAssertEqual(TestpkgAnInt, 7, @"TestpkgAnInt = %lld, want 7", TestpkgAnInt);
	XCTAssertTrue(ABS(TestpkgAFloat - 0.12345) < 0.0001, @"TestpkgAFloat = %f, want 0.12345", TestpkgAFloat);
	XCTAssertTrue(TestpkgABool == YES, @"TestpkgABool = %@, want YES", TestpkgAFloat ? @"YES" : @"NO");
	XCTAssertEqual(TestpkgMinInt32, INT32_MIN, @"TestpkgMinInt32 = %d, want %d", TestpkgMinInt32, INT32_MIN);
	XCTAssertEqual(TestpkgMaxInt32, INT32_MAX, @"TestpkgMaxInt32 = %d, want %d", TestpkgMaxInt32, INT32_MAX);
	XCTAssertEqual(TestpkgMinInt64, INT64_MIN, @"TestpkgMinInt64 = %lld, want %lld", TestpkgMinInt64, INT64_MIN);
	XCTAssertEqual(TestpkgMaxInt64, INT64_MAX, @"TestpkgMaxInt64 = %lld, want %lld", TestpkgMaxInt64, INT64_MAX);
	XCTAssertTrue(ABS(TestpkgSmallestNonzeroFloat64 -
		4.940656458412465441765687928682213723651e-324) < 1e-323, @"TestpkgSmallestNonzeroFloat64 = %f, want %f",
		TestpkgSmallestNonzeroFloat64,
		4.940656458412465441765687928682213723651e-324);
	XCTAssertTrue(ABS(TestpkgMaxFloat64 -
		1.797693134862315708145274237317043567981e+308) < 0.0001, @"TestpkgMaxFloat64 = %f, want %f", TestpkgMaxFloat64,
		1.797693134862315708145274237317043567981e+308);
	XCTAssertTrue(ABS(TestpkgSmallestNonzeroFloat32 -
		1.401298464324817070923729583289916131280e-45) < 1e-44, @"TestpkgSmallestNonzeroFloat32 = %f, want %f",
		TestpkgSmallestNonzeroFloat32,
		1.401298464324817070923729583289916131280e-45);
	XCTAssertTrue(ABS(TestpkgMaxFloat32 - 3.40282346638528859811704183484516925440e+38) < 0.0001,
		@"TestpkgMaxFloat32 = %f, want %f", TestpkgMaxFloat32, 3.40282346638528859811704183484516925440e+38);
	XCTAssertTrue(ABS(TestpkgLog2E - 1 / 0.693147180559945309417232121458176568075500134360255254120680009) < 0.0001,
		@"TestpkgLog2E = %f, want %f", TestpkgLog2E, 1 / 0.693147180559945309417232121458176568075500134360255254120680009);
}

- (void)testIssue12307 {
	Number *num = [[Number alloc] init];
	num.value = 1024;
	NSError *error;
	XCTAssertFalse(TestpkgCallIError(num, YES, &error), @"TestpkgCallIError(Number, YES) succeeded; want error");
	NSError *error2;
	XCTAssertTrue(TestpkgCallIError(num, NO, &error2), @"TestpkgCallIError(Number, NO) failed(%@); want success", error2);
}

- (void)testErrorField {
	NSString *wantMsg = @"an error message";
	NSError *want = [NSError errorWithDomain:@"SeqTest" code:1 userInfo:@{NSLocalizedDescriptionKey: wantMsg}];
	TestpkgNode *n = TestpkgNewNode(@"ErrTest");
	n.err = want;
	NSError *got = n.err;
	XCTAssertEqual(got, want, @"got different objects after roundtrip");
	NSString *gotMsg = TestpkgErrorMessage(want);
	XCTAssertEqualObjects(gotMsg, wantMsg, @"err = %@, want %@", gotMsg, wantMsg);
}

- (void)testErrorDup {
	NSError *err = Testpkg.globalErr;
	XCTAssertTrue(TestpkgIsGlobalErr(err), @"A Go error must preserve its identity across the boundary");
	XCTAssertEqualObjects([err localizedDescription], @"global err", "A Go error message must be preserved");
}

- (void)testVar {
	NSString *s = Testpkg.stringVar;
	XCTAssertEqualObjects(s, @"a string var", @"Testpkg.StringVar = %@, want 'a string var'", s);
	s = @"a new string var";
	Testpkg.stringVar = s;
	NSString *s2 = Testpkg.stringVar;
	XCTAssertEqualObjects(s2, s, @"Testpkg.stringVar = %@, want %@", s2, s);

	int64_t i = Testpkg.intVar;
	XCTAssertEqual(i, 77, @"Testpkg.intVar = %lld, want 77", i);
	Testpkg.intVar = 777;
	i = Testpkg.intVar;
	XCTAssertEqual(i, 777, @"Testpkg.intVar = %lld, want 777", i);
	[Testpkg setIntVar:7777];
	i = [Testpkg intVar];
	XCTAssertEqual(i, 7777, @"Testpkg.intVar = %lld, want 7777", i);

	TestpkgNode *n0 = Testpkg.nodeVar;
	XCTAssertEqualObjects(n0.v, @"a struct var", @"Testpkg.NodeVar = %@, want 'a struct var'", n0.v);
	TestpkgNode *n1 = TestpkgNewNode(@"a new struct var");
	Testpkg.nodeVar = n1;
	TestpkgNode *n2 = Testpkg.nodeVar;
	XCTAssertEqualObjects(n2.v, @"a new struct var", @"Testpkg.NodeVar = %@, want 'a new struct var'", n2.v);

	Number *num = [[Number alloc] init];
	num.value = 12345;
	Testpkg.interfaceVar2 = num;
	id<TestpkgI2> iface = Testpkg.interfaceVar2;
	int64_t x = [iface times:10];
	int64_t y = [num times:10];
	XCTAssertEqual(x, y, @"Testpkg.InterfaceVar2 Times 10 = %lld, want %lld", x, y);
}

- (void)testIssue12403 {
	Number *num = [[Number alloc] init];
	num.value = 1024;

	NSError *error;
	NSString *ret = TestpkgCallIStringError(num, @"alphabet", &error);
	XCTAssertNil(ret, @"TestpkgCallIStringError(Number, 'alphabet') succeeded(%@); want error", ret);
	NSString *desc = [error localizedDescription];
	XCTAssertEqualObjects(desc, @"NumberError", @"TestpkgCallIStringError(Number, 'alphabet') returned unexpected error message %@", desc);
	NSError *error2;
	NSString *ret2 = TestpkgCallIStringError(num, @"number", &error2);
	XCTAssertNotNil(ret2, @"TestpkgCallIStringError(Number, 'number') failed(%@); want success", error2);
	XCTAssertEqualObjects(ret2, @"OK", @"TestpkgCallIStringError(Number, 'number') returned unexpected results %@", ret2);
}

- (void)testStrDup:(NSString *)want {
	NSString *got = TestpkgStrDup(want);
	XCTAssertEqualObjects(want, got, @"StrDup returned %@; expected %@", got, want);
}

- (void)testUnicodeStrings {
	[self testStrDup:@"abcxyz09{}"];
	[self testStrDup:@"Hello, 世界"];
	[self testStrDup:@"\uffff\U00010000\U00010001\U00012345\U0010ffff"];
}

- (void)testByteArrayRead {
	NSData *arr = [NSMutableData dataWithLength:8];
	long n;
	XCTAssertTrue(TestpkgReadIntoByteArray(arr, &n, nil), @"ReadIntoByteArray failed");
	XCTAssertEqual(n, 8, @"ReadIntoByteArray wrote %ld bytes, expected %d", n, 8);
	const uint8_t *b = [arr bytes];
	for (int i = 0; i < [arr length]; i++) {
		XCTAssertEqual(b[i], i, @"ReadIntoByteArray wrote %d at %d; expected %d", b[i], i, i);
	}
	// Test that immutable data cannot be changed from Go
	const uint8_t buf[] = {42};
	arr = [NSData dataWithBytes:buf length:1];
	XCTAssertTrue(TestpkgReadIntoByteArray(arr, &n, nil), @"ReadIntoByteArray failed");
	XCTAssertEqual(n, 1, @"ReadIntoByteArray wrote %ld bytes, expected %d", n, 8);
	b = [arr bytes];
	XCTAssertEqual(b[0], 42, @"ReadIntoByteArray wrote to an immutable NSData; expected no change");
}

- (void)testNilField {
	TestpkgNullFieldStruct *s = TestpkgNewNullFieldStruct();
	XCTAssertNil([s f], @"NullFieldStruct has non-nil field; expected nil");
}

- (void)testNullReferences {
	NullTest *t = [[NullTest alloc] init];
	XCTAssertTrue(TestpkgCallWithNull(nil, t), @"Testpkg.CallWithNull failed");
	id<TestpkgI> i = TestpkgNewNullInterface();
	XCTAssertNil(i, @"NewNullInterface() returned %p; expected nil", i);
	TestpkgS *s = TestpkgNewNullStruct();
	XCTAssertNil(s, @"NewNullStruct() returned %p; expected nil", s);
	TestpkgIssue20330 *nullArger = TestpkgNewIssue20330();
	XCTAssertTrue([nullArger callWithNull:nil], @"Issue20330.CallWithNull failed");
}

- (void)testReturnsError {
	NSError *error;
	NSString *value = TestpkgReturnsError(TRUE, &error);
	NSString *got = [error.userInfo valueForKey:NSLocalizedDescriptionKey];
	NSString *want = @"Error";
	XCTAssertEqualObjects(got, want, @"want %@\nTestpkgReturnsError(TRUE) = (%@, %@)", want, value, got);
}

- (void)testImportedPkg {
	XCTAssertEqualObjects(SecondpkgHelloString, SecondpkgHello(), @"imported string should match");
	id<SecondpkgI> i = TestpkgNewImportedI();
	SecondpkgS *s = TestpkgNewImportedS();
	XCTAssertEqual(8, [i f:8], @"numbers should match");
	XCTAssertEqual(8, [s f:8], @"numbers should match");
	i = TestpkgWithImportedI(i);
	s = TestpkgWithImportedS(s);
	i = [Testpkg importedVarI];
	s = [Testpkg importedVarS];
	[Testpkg setImportedVarI:i];
	[Testpkg setImportedVarS:s];
	TestpkgImportedFields *fields = TestpkgNewImportedFields();
	i = [fields i];
	s = [fields s];
	[fields setI:i];
	[fields setS:s];
}

- (void)testRoundTripEquality {
	Number *want = [[Number alloc] init];
	Number *got = (Number *)TestpkgI2Dup(want);
	XCTAssertEqual(got, want, @"ObjC object passed through Go should not be wrapped");

	IDup *idup = [[IDup alloc] init];
	XCTAssertTrue(TestpkgCallIDupper(idup), @"Go interface passed through ObjC should not be wrapped");
	CDup *cdup = [[CDup alloc] init];
	XCTAssertTrue(TestpkgCallCDupper(cdup), @"Go struct passed through ObjC should not be wrapped");
}

- (void)testEmptyError {
	NSError *error;
	XCTAssertFalse(TestpkgEmptyError(&error), @"GoTestpkgEmptyError succeeded; want error");
	XCTAssertNotNil(error, @"TestpkgEmptyError returned nil error");
	id<TestpkgEmptyErrorer> empty = [[EmptyErrorer alloc] init];
	XCTAssertFalse(TestpkgCallEmptyError(empty, &error), @"TestpkgCallEmptyError succeeded; want error");
	XCTAssertNotNil(error, @"TestpkgCallEmptyError returned nil error");
}

- (void)testSIGPIPE {
	TestpkgTestSIGPIPE();
}

- (void)testTags {
	XCTAssertEqual(42, TestpkgTaggedConst, @"Tagged const must exist");
}

- (void)testConstructors {
	id<TestpkgInterface> i = [[TestpkgConcrete alloc] init];
	[i f];

	TestpkgS2 *s = [[TestpkgS2 alloc] init:1 y:2];
	XCTAssertEqual(3.0, [s sum]);
	XCTAssertEqualObjects(@"gostring", [s tryTwoStrings:@"go" second:@"string"]);

	TestpkgS3 *s3 __attribute__((unused)) = [[TestpkgS3 alloc] init];

	TestpkgS4 *s4 = [[TestpkgS4 alloc] initWithInt:123];
	XCTAssertEqual(123, s4.i);

	s4 = [[TestpkgS4 alloc] initWithFloat: 123.456];
	XCTAssertEqual(123, s4.i);

	s4 = [[TestpkgS4 alloc] initWithBoolAndError: false];
	XCTAssertEqual(0, s4.i);

	s4 = [[TestpkgS4 alloc] initWithBoolAndError: true];
	XCTAssertEqual(s4, NULL);
}

@end
