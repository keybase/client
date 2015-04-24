//
//  KBPGPDecrypt.m
//  Keybase
//
//  Created by Gabriel on 3/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPDecrypt.h"

#import "KBRunOver.h"
#import "KBUserProfileView.h"
#import "KBRPC.h"
#import "KBStream.h"
#import "KBWork.h"
#import "KBPGPDecrypted.h"

@interface KBPGPDecrypt ()
@property KBUserProfileView *trackView;
@end

@implementation KBPGPDecrypt

- (void)decryptWithOptions:(KBRPgpDecryptOptions *)options streams:(NSArray *)streams client:(KBRPClient *)client sender:(id)sender completion:(void (^)(NSArray *works))completion {
  KBRunOver *sb = [[KBRunOver alloc] init];
  sb.objects = streams;
  sb.work = ^(KBStream *stream, KBWorkCompletion workCompletion) {
    [self decryptWithOptions:options stream:stream client:client sender:sender completion:workCompletion];
  };
  sb.completion = completion;
  [sb run];
}

- (void)decryptWithOptions:(KBRPgpDecryptOptions *)options stream:(KBStream *)stream client:(KBRPClient *)client sender:(id)sender completion:(KBWorkCompletion)completion {
  KBRPgpRequest *request = [[KBRPgpRequest alloc] initWithClient:client];

  [self registerTrackView:request.sessionId client:client sender:sender];

  [stream registerWithClient:client sessionId:request.sessionId];

  KBRStream *source = [[KBRStream alloc] init];
  source.fd = stream.label;

  KBRStream *sink = [[KBRStream alloc] init];
  sink.fd = stream.label;

  [request pgpDecryptWithSessionID:request.sessionId source:source sink:sink opts:options completion:^(NSError *error, KBRPgpSigVerification *pgpSigVerification) {
    KBPGPDecrypted *decrypted = [KBPGPDecrypted decryptedWithStream:stream pgpSigVerification:pgpSigVerification];
    KBWork *work = [KBWork workWithInput:stream output:decrypted error:error];
    completion(work);
  }];
}

- (void)registerTrackView:(NSInteger)sessionId client:(KBRPClient *)client sender:(id)sender {
  _trackView = [[KBUserProfileView alloc] init];
  _trackView.popup = YES;
  [_trackView registerClient:client sessionId:sessionId sender:sender];
}

@end
