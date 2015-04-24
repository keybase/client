//
//  KBPGPEncrypt.m
//  Keybase
//
//  Created by Gabriel on 3/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPEncrypt.h"

#import "KBUserProfileView.h"
#import "KBRunOver.h"

@interface KBPGPEncrypt ()
@property KBUserProfileView *trackView;
@end

@implementation KBPGPEncrypt

- (void)encryptWithOptions:(KBRPgpEncryptOptions *)options streams:(NSArray *)streams client:(KBRPClient *)client sender:(id)sender completion:(void (^)(NSArray *works))completion {
  KBRunOver *sb = [[KBRunOver alloc] init];
  sb.objects = streams;
  sb.work = ^(KBStream *stream, KBWorkCompletion workCompletion) {
    [self encryptWithOptions:options stream:stream client:client sender:sender completion:workCompletion];
  };
  sb.completion = completion;
  [sb run];
}

- (void)encryptWithOptions:(KBRPgpEncryptOptions *)options stream:(KBStream *)stream client:(KBRPClient *)client sender:(id)sender completion:(KBWorkCompletion)completion {
  KBRPgpRequest *request = [[KBRPgpRequest alloc] initWithClient:client];

  [self registerTrackView:request.sessionId client:client sender:sender];

  [stream registerWithClient:client sessionId:request.sessionId];

  KBRStream *source = [[KBRStream alloc] init];
  source.fd = stream.label;

  KBRStream *sink = [[KBRStream alloc] init];
  sink.fd = stream.label;

  [request pgpEncryptWithSessionID:request.sessionId source:source sink:sink opts:options completion:^(NSError *error) {
    completion([KBWork workWithInput:stream output:stream error:error]);
  }];
}

- (void)registerTrackView:(NSInteger)sessionId client:(KBRPClient *)client sender:(id)sender {
  _trackView = [[KBUserProfileView alloc] init];
  _trackView.popup = YES;
  [_trackView registerClient:client sessionId:sessionId sender:sender];
}

@end
