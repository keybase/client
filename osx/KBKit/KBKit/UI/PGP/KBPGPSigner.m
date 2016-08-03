//
//  KBPGPSigner.m
//  Keybase
//
//  Created by Gabriel on 3/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPSigner.h"
#import "KBRunOver.h"
#import "KBWork.h"

@implementation KBPGPSigner

- (void)signWithOptions:(KBRPGPSignOptions *)options streams:(NSArray *)streams client:(KBRPClient *)client sender:(id)sender completion:(void (^)(NSArray *works, BOOL stop))completion {
  KBRunOver *runOver = [[KBRunOver alloc] init];
  runOver.enumerator = [streams objectEnumerator];
  runOver.runBlock = ^(KBStream *stream, KBRunCompletion runCompletion) {
    [self signWithOptions:options stream:stream client:client sender:sender completion:runCompletion];
  };
  runOver.completion = completion;
  [runOver run];
}

- (void)signWithOptions:(KBRPGPSignOptions *)options stream:(KBStream *)stream client:(KBRPClient *)client sender:(id)sender completion:(KBRunCompletion)completion {
  KBRPgpRequest *request = [[KBRPgpRequest alloc] initWithClient:client];

  [stream registerWithClient:client sessionId:request.sessionId];

  KBRStream *source = [[KBRStream alloc] init];
  source.fd = stream.label;

  KBRStream *sink = [[KBRStream alloc] init];
  sink.fd = stream.label;

  [request pgpSignWithSource:source sink:sink opts:options completion:^(NSError *error) {
    completion([KBWork workWithInput:stream output:stream error:error], NO);
  }];
}

@end
