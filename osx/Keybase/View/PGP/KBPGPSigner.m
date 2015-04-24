//
//  KBPGPSigner.m
//  Keybase
//
//  Created by Gabriel on 3/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPSigner.h"
#import "KBRunOver.h"

@implementation KBPGPSigner

- (void)signWithOptions:(KBRPgpSignOptions *)options streams:(NSArray *)streams client:(KBRPClient *)client sender:(id)sender completion:(void (^)(NSArray *works))completion {
  KBRunOver *sb = [[KBRunOver alloc] init];
  sb.objects = streams;
  sb.work = ^(KBStream *stream, KBWorkCompletion workCompletion) {
    [self signWithOptions:options stream:stream client:client sender:sender completion:workCompletion];
  };
  sb.completion = completion;
  [sb run];
}

- (void)signWithOptions:(KBRPgpSignOptions *)options stream:(KBStream *)stream client:(KBRPClient *)client sender:(id)sender completion:(KBWorkCompletion)completion {
  KBRPgpRequest *request = [[KBRPgpRequest alloc] initWithClient:client];

  [stream registerWithClient:client sessionId:request.sessionId];

  KBRStream *source = [[KBRStream alloc] init];
  source.fd = stream.label;

  KBRStream *sink = [[KBRStream alloc] init];
  sink.fd = stream.label;

  [request pgpSignWithSessionID:request.sessionId source:source sink:sink opts:options completion:^(NSError *error) {
    completion([KBWork workWithInput:stream output:stream error:error]);
  }];
}

@end
