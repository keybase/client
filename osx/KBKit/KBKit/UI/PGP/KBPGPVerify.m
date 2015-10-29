//
//  KBPGPVerify.m
//  Keybase
//
//  Created by Gabriel on 3/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPVerify.h"

@implementation KBPGPVerify

- (void)verifyWithOptions:(KBRPGPVerifyOptions *)options stream:(KBStream *)stream client:(KBRPClient *)client sender:(id)sender completion:(void (^)(NSError *error, KBStream *stream, KBRPGPSigVerification *pgpSigVerification))completion {
  KBRPgpRequest *request = [[KBRPgpRequest alloc] initWithClient:client];

  [stream registerWithClient:client sessionId:request.sessionId];

  KBRStream *source = [[KBRStream alloc] init];
  source.fd = stream.label;

  [request pgpVerifyWithSource:source opts:options completion:^(NSError *error, KBRPGPSigVerification *pgpSigVerification) {

    if (error && error.code == 1504) {
      error = KBErrorAlert(@"This appears to be a detached signature. You need to specify both the signature and the file to verify against.");
    }

    completion(error, stream, pgpSigVerification);
  }];
}

@end
