//
//  KBRPClientTest.m
//  Keybase
//
//  Created by Gabriel on 12/16/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <GRUnit/GRUnit.h>

#import <MPMessagePack/MPMessagePackServer.h>

#import "KBRPC.h"

@interface KBRPClientTest : GRTestCase
@end

@implementation KBRPClientTest

- (void)testClient:(dispatch_block_t)completion {
  
  MPMessagePackServer *server = [[MPMessagePackServer alloc] initWithOptions:MPMessagePackOptionsFramed];
  
  server.requestHandler = ^(NSString *method, id params, MPRequestCompletion completion) {
    if ([method isEqualToString:@"signUp"]) {
      KBSignUpResponse *response = [[KBSignUpResponse alloc] init];
      response.uid = [[KBUID alloc] init];
      response.uid.data = @"userid";
      response.passphraseOk = YES;
      NSDictionary *dict = [MTLJSONAdapter JSONDictionaryFromModel:response];      
      completion(nil, dict);
    } else {
      KBError *error = [[KBError alloc] init];
      error.code = 404;
      completion(nil, nil);
    }
  };
  
  NSError *error = nil;
  if (![server openWithPort:41111 error:&error]) {
    GRFail(@"Unable to start server: %@", error);
  }
  
  KBRPClient *client = [[KBRPClient alloc] init];
  [client open:^(NSError *error) {
    if (error) GRErrorHandler(error);
    GRTestLog(@"Sending request");

    KBRSignup *signUp = [[KBRSignup alloc] initWithClient:client];
    [signUp signUpWithEmail:@"test@email.com" inviteCode:@"1" password:@"toomanysecrets" username:@"gabriel" completion:^(NSError *error, KBSignUpResponse *signUpResponse) {
      if (error) GRErrorHandler(error);
      
      GRTestLog(@"%@", signUpResponse);
      completion();
    }];
  }];
  
  [self wait:10];
}

@end
