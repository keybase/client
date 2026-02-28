//
//  MPMessagePack
//
//  Created by Gabriel on 5/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <XCTest/XCTest.h>

#import <MPMessagePack/MPMessagePack.h>

@interface MPMessagePackTest : XCTestCase
@end

@interface Unsupported : NSObject
@end

@implementation Unsupported
@end

@implementation MPMessagePackTest

- (void)testEmpty {
  NSData *data1 = [MPMessagePackWriter writeObject:@[] error:nil];
  NSArray *read1 = [MPMessagePackReader readData:data1 options:0 error:nil];
  XCTAssertEqualObjects(@[], read1);
}

- (void)testPackUnpack {
  NSDictionary *obj =
  @{
    @"z": @(0),
    @"p": @(1),
    @"n": @(-1),
    @"u8": @(UINT8_MAX),
    @"u16": @(UINT16_MAX),
    @"u32": @(UINT32_MAX),
    @"u64": @(UINT64_MAX),
    @"s8": @(INT8_MAX),
    @"s16": @(INT16_MAX),
    @"s32": @(INT32_MAX),
    @"s64": @(INT64_MAX),
    @"n8": @(INT8_MIN),
    @"n16": @(INT16_MIN),
    @"n32": @(INT32_MIN),
    @"n64": @(INT64_MIN),
    @"arrayFloatDouble": @[@(1.1f), @(2.1)],
    @"dataEmpty": [NSData data],
    @"dataShort": [NSData mp_dataFromHexString:@"ff"],
    @"data": [NSData mp_dataFromHexString:@"1c94d7de0000000344b409a81eafc66993cbe5fd885b5f6975a3f1f03c7338452116f7200a46412437007b65304528a314756bc701cec7b493cab44b3971b18c1137c1b1ba63d6a61119a5a2298b447d0cba89071320fc2c0f66b8f8056cd043d1ac6c0e983903355310e794ddd4a532729b3c2d65d71ebff32219f2f1759b3952d686149780c8e20f6bc912e5ba44701cdb165fcf5ab266c4295bf84796f9ac01c4e2ddf91ac7932d7ed71ee6187aa5fc3177b1abefdc29d8dec5098465b31f17511f65d38285f213724fcc98fe9cc6842c28d5"],
    @"null": [NSNull null],
    @"str": @"🍆😗😂😰",
    };
  NSLog(@"Obj: %@", obj);
  
  NSData *data2 = [obj mp_messagePack];
  NSDictionary *read2 = [MPMessagePackReader readData:data2 options:0 error:nil];
  XCTAssertEqualObjects(obj, read2);
  
  NSData *data3 = [MPMessagePackWriter writeObject:obj options:MPMessagePackWriterOptionsSortDictionaryKeys error:nil];
  NSError *error = nil;
  NSDictionary *read3 = [MPMessagePackReader readData:data3 options:0 error:&error];
  XCTAssertEqualObjects(obj, read3);
}

- (void)testBool {
  NSArray *obj = @[@(YES), @YES, @(NO), @NO, [NSNumber numberWithBool:YES], [NSNumber numberWithBool:NO]];
  NSData *data = [obj mp_messagePack];
  NSArray *read = [MPMessagePackReader readData:data options:0 error:nil];
  NSLog(@"Bools: %@", read);
  XCTAssertEqualObjects(obj, read);
  XCTAssertEqual(read[0], @(YES));
  XCTAssertEqual(read[1], @YES);
  XCTAssertEqual(read[2], @(NO));
  XCTAssertEqual(read[3], @NO);
}

- (void)testMultiple {
  NSError *error = nil;
  NSMutableData *data = [NSMutableData dataWithData:[MPMessagePackWriter writeObject:@(1) error:&error]];
  [data appendData:[MPMessagePackWriter writeObject:@{@"a": @(1)} error:&error]];
  [data appendData:[MPMessagePackWriter writeObject:@[@(1), @(2)] error:&error]];
  
  NSMutableData *subdata = [[data subdataWithRange:NSMakeRange(0, data.length - 1)] mutableCopy];
  MPMessagePackReader *reader = [[MPMessagePackReader alloc] initWithData:subdata];
  id obj1 = [reader readObject:nil];
  id obj2 = [reader readObject:nil];
  
  XCTAssertEqualObjects(obj1, @(1));
  XCTAssertEqualObjects(obj2, @{@"a": @(1)});
  
  size_t index = reader.index;
  id obj3 = [reader readObject:&error];
  XCTAssertNil(obj3);
  XCTAssertNotNil(error);
  XCTAssertEqual(error.code, (NSInteger)200);
  XCTAssertEqual(reader.index, (size_t)index); // Make sure error resets index
  
  [subdata appendData:[data subdataWithRange:NSMakeRange(data.length - 1, 1)]];
  obj3 = [reader readObject:nil];
  id expected3 = @[@(1), @(2)];
  XCTAssertEqualObjects(obj3, expected3);
}

- (void)testRandomData {
  NSUInteger length = 1024 * 32;
  NSMutableData *data = [NSMutableData dataWithLength:length];
  int result = SecRandomCopyBytes(kSecRandomDefault, length, [data mutableBytes]);
  XCTAssert(result == 0);
  
  NSError *error = nil;
  [MPMessagePackReader readData:data options:0 error:&error];
  NSLog(@"Error: %@", error);
  // Just don't crash
}

- (void)testMap {
  NSDictionary *d = @{@"identify": @(YES)};
  NSData *data = [MPMessagePackWriter writeObject:d options:0 error:nil];
  NSLog(@"Data: %@", [data mp_hexString]);
}

- (void)testUnsignedLongLong {
  uint64_t n = 9223372036854775807; //18446744073709551615;
  NSNumber *numberIn = [NSNumber numberWithUnsignedLongLong:n];

  NSData *data = [MPMessagePackWriter writeObject:numberIn options:0 error:nil];
  NSNumber *numberOut = [MPMessagePackReader readData:data error:nil];
  XCTAssertTrue([numberOut longLongValue] == n);
}

- (void)testLongLong {
  int64_t n = -9223372036854775807;
  NSNumber *numberIn = [NSNumber numberWithLongLong:n];

  NSData *data = [MPMessagePackWriter writeObject:numberIn options:0 error:nil];
  NSNumber *numberOut = [MPMessagePackReader readData:data error:nil];
  XCTAssertTrue([numberOut longLongValue] == n);
}

- (void)testInvalidDictData {
  NSData *data = [NSData mp_dataFromHexString:@"deadbeef"];
  NSError *error = nil;
  XCTAssertFalse({ [data mp_dict:&error]; });
  XCTAssertNotNil(error);
}

- (void)testInvalidArrayData {
  NSData *data = [NSData mp_dataFromHexString:@"deadbeef"];
  NSError *error = nil;
  XCTAssertFalse({ [data mp_array:&error]; });
  XCTAssertNotNil(error);
}

- (void)testStress {
  NSDictionary *dict = @{@("a"): @(1)};
  NSData *data = [MPMessagePackWriter writeObject:dict options:0 error:nil];
  for (NSInteger i = 0; i < 1000; i++) {
    MPMessagePackReader *reader = [[MPMessagePackReader alloc] initWithData:data];
    NSDictionary *dictRead = [reader readObject:nil];
    XCTAssertEqualObjects(dict, dictRead);
  }
}

- (void)testHex {
  NSString *hex = @"940001b36b6579626173652e312e746573742e746573749182a973657373696f6e494402a46e616d65a774657374417267";
  NSData *data = [NSData mp_dataFromHexString:hex];
  MPMessagePackReader *reader = [[MPMessagePackReader alloc] initWithData:data];
  NSError *error = nil;
  id obj;
  while ((obj = [reader readObject:&error])) {
    NSLog(@"%@", obj);
  }
}

- (void)testNilOnError {
  NSError *error = nil;
  NSData *data = [MPMessagePackWriter writeObject:[[Unsupported alloc] init] options:0 error:&error];
  XCTAssertNotNil(error);
  XCTAssertNil(data);
}

// For testing a compatibility issue with go msgpack
//- (void)testMessage {
//  NSString *s = @"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";
//
//  NSData *data = [[NSData alloc] initWithBase64EncodedString:s options:0];
//  MPMessagePackReader *reader = [[MPMessagePackReader alloc] initWithData:data];
//  id obj = [reader readObject:nil];
//  NSLog(@"%@", obj);
//}

@end
