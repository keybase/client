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

- (void)testClient:(dispatch_block_t)completion {
  
  MPMessagePackServer *server = [[MPMessagePackServer alloc] initWithOptions:MPMessagePackOptionsFramed];
  
  server.requestHandler = ^(NSString *method, id params, MPRequestCompletion completion) {
    if ([method isEqualToString:@"signup"]) {
      KBSignupRes *response = [[KBSignupRes alloc] init];
      response.body.passphraseOk = YES;
      NSDictionary *dict = [MTLJSONAdapter JSONDictionaryFromModel:response];
      completion(nil, dict);
    } else {
      KBSignupRes *response = [[KBSignupRes alloc] init];
      response.status = [[KBStatus alloc] init];
      NSDictionary *dict = [MTLJSONAdapter JSONDictionaryFromModel:response];
      completion(nil, dict);
    }
  };
  
  NSError *error = nil;
  //@"/tmp/keybase-gabe/keybased.sock"
  NSString *socketName = [NSString stringWithFormat:@"/tmp/msgpacktest-%@.socket", @(arc4random())];
  if (![server openWithSocket:socketName error:&error]) {
    GRFail(@"Unable to start server: %@", error);
  }
  
  KBRPClient *client = [[KBRPClient alloc] init];
  [client open:^(NSError *error) {
    if (error) GRErrorHandler(error);
    GRTestLog(@"Sending request");

    KBRSignup *signUp = [[KBRSignup alloc] initWithClient:client];
    [signUp signupWithEmail:@"test@email.com" inviteCode:@"1" passphrase:@"toomanysecrets" username:@"gabriel" completion:^(NSError *error, KBSignupRes *res) {
      GRErrorHandler(error);
      GRTestLog(@"%@", res);
      completion();
    }];
  }];
  
  [self wait:10];
}

@end
