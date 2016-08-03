//
//  KBPGPDecrypt.m
//  Keybase
//
//  Created by Gabriel on 3/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPDecrypt.h"

#import "KBUserProfileView.h"
#import "KBRPC.h"
#import "KBStream.h"
#import "KBPGPDecrypted.h"
#import "KBWork.h"

@interface KBPGPDecrypt ()
@property KBUserProfileView *trackView;
@end

@implementation KBPGPDecrypt

- (void)decryptWithOptions:(KBRPGPDecryptOptions *)options streams:(NSArray *)streams client:(KBRPClient *)client sender:(id)sender completion:(void (^)(NSArray *works, BOOL stopped))completion {
  KBRunOver *runOver = [[KBRunOver alloc] init];
  runOver.enumerator = [streams objectEnumerator];
  runOver.runBlock = ^(KBStream *stream, KBRunCompletion runCompletion) {
    [self decryptWithOptions:options stream:stream client:client sender:sender completion:runCompletion];
  };
  runOver.completion = completion;
  [runOver run];
}

- (void)decryptWithOptions:(KBRPGPDecryptOptions *)options stream:(KBStream *)stream client:(KBRPClient *)client sender:(id)sender completion:(KBRunCompletion)completion {
  KBRPgpRequest *request = [[KBRPgpRequest alloc] initWithClient:client];

  [self registerTrackView:request.sessionId client:client sender:sender];

  [stream registerWithClient:client sessionId:request.sessionId];

  KBRStream *source = [[KBRStream alloc] init];
  source.fd = stream.label;

  KBRStream *sink = [[KBRStream alloc] init];
  sink.fd = stream.label;

  [request pgpDecryptWithSource:source sink:sink opts:options completion:^(NSError *error, KBRPGPSigVerification *pgpSigVerification) {
    KBPGPDecrypted *decrypted = [KBPGPDecrypted decryptedWithStream:stream pgpSigVerification:pgpSigVerification];
    KBWork *work = [KBWork workWithInput:stream output:decrypted error:error];
    completion(work, NO);
  }];
}

- (void)registerTrackView:(NSNumber *)sessionId client:(KBRPClient *)client sender:(id)sender {
  NSAssert([sender window], @"No window");
  _trackView = [[KBUserProfileView alloc] init];
  _trackView.popup = YES;
  _trackView.fromWindow = [sender window];
  [_trackView registerClient:client sessionId:sessionId];
}

@end
