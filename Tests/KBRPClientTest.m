//
//  KBRPClientTest.m
//  Keybase
//
//  Created by Gabriel on 12/16/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <GRUnit/GRUnit.h>

#import <MPMessagePack/MPMessagePackServer.h>
#import <NAChloride/NAChloride.h>

#import "KBRPC.h"

@interface KBRPClientTest : GRTestCase
@end

@implementation KBRPClientTest

- (void)testData {
  KBUID *uid = [[KBUID alloc] init];
  uid.data = [@"deadbeef" na_dataFromHexString];
  NSDictionary *dict = [MTLJSONAdapter JSONDictionaryFromModel:uid];
  GRTestLog(@"Dict: %@", dict);
  
  NSError *error = nil;
  KBUID *uid2 = [MTLJSONAdapter modelOfClass:KBUID.class fromJSONDictionary:dict error:&error];
  if (error) GRErrorHandler(error);
  GRTestLog(@"Data: %@", [uid2.data na_hexString]);
}

@end
