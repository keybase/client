//
//  KBPGPVerify.m
//  Keybase
//
//  Created by Gabriel on 3/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPVerify.h"

#import "KBSerialBox.h"

@implementation KBPGPVerify

- (void)verifyWithOptions:(KBRPgpVerifyOptions *)options stream:(KBStream *)stream client:(KBRPClient *)client sender:(id)sender completion:(void (^)(NSError *error, KBStream *stream, KBRPgpSigVerification *pgpSigVerification))completion {
  KBRPgpRequest *request = [[KBRPgpRequest alloc] initWithClient:client];

  [stream registerWithClient:client sessionId:request.sessionId];

  KBRStream *source = [[KBRStream alloc] init];
  source.fd = stream.label;

  [request pgpVerifyWithSessionID:request.sessionId source:source opts:options completion:^(NSError *error, KBRPgpSigVerification *pgpSigVerification) {

    if (error && error.code == 1504) {
      error = KBMakeError(-1, @"This appears to be a detached signature. You need to specify both the signature and the file to verify against.");
    }

    completion(error, stream, pgpSigVerification);
  }];
}

@end
