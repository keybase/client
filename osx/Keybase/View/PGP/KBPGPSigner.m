//
//  KBPGPSigner.m
//  Keybase
//
//  Created by Gabriel on 3/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPSigner.h"
#import "KBSerialBox.h"

@implementation KBPGPSigner

- (void)signWithOptions:(KBRPgpSignOptions *)options streams:(NSArray *)streams client:(KBRPClient *)client sender:(id)sender completion:(void (^)(NSError *error, NSArray *streams))completion {
  KBSerialBox *sb = [[KBSerialBox alloc] init];
  sb.objects = streams;
  sb.runBlock = ^(KBStream *stream, BOOL finished, KBCompletionHandler runCompletion) {
    [self signWithOptions:options stream:stream client:client sender:sender completion:^(NSError *error, KBStream *stream) {
      runCompletion(error);
    }];
  };
  sb.completionBlock = ^(NSArray *streams) {
    completion(nil, streams);
  };
  [sb run];
}

- (void)signWithOptions:(KBRPgpSignOptions *)options stream:(KBStream *)stream client:(KBRPClient *)client sender:(id)sender completion:(void (^)(NSError *error, KBStream *stream))completion {
  KBRPgpRequest *request = [[KBRPgpRequest alloc] initWithClient:client];

  [stream registerWithClient:client sessionId:request.sessionId];

  KBRStream *source = [[KBRStream alloc] init];
  source.fd = stream.label;

  KBRStream *sink = [[KBRStream alloc] init];
  sink.fd = stream.label;

  [request pgpSignWithSessionID:request.sessionId source:source sink:sink opts:options completion:^(NSError *error) {
    completion(error, stream);
  }];
}

@end
