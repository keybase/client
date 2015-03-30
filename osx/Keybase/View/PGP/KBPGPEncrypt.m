//
//  KBPGPEncrypt.m
//  Keybase
//
//  Created by Gabriel on 3/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPEncrypt.h"

#import "KBUserProfileView.h"
#import "KBSerialBox.h"

@interface KBPGPEncrypt ()
@property KBUserProfileView *trackView;
@end

@implementation KBPGPEncrypt

- (void)encryptWithOptions:(KBRPgpEncryptOptions *)options streams:(NSArray *)streams client:(KBRPClient *)client sender:(id)sender completion:(void (^)(NSError *error, NSArray *streams))completion {
  KBSerialBox *sb = [[KBSerialBox alloc] init];
  sb.objects = streams;
  sb.runBlock = ^(KBStream *stream, BOOL finished, KBCompletionHandler runCompletion) {
    [self encryptWithOptions:options stream:stream client:client sender:sender completion:^(NSError *error, KBStream *stream) {
      runCompletion(error);
    }];
  };
  sb.completionBlock = ^(NSArray *streams) {
    completion(nil, streams);
  };
  [sb run];
}

- (void)encryptWithOptions:(KBRPgpEncryptOptions *)options stream:(KBStream *)stream client:(KBRPClient *)client sender:(id)sender completion:(void (^)(NSError *error, KBStream *stream))completion {
  KBRPgpRequest *request = [[KBRPgpRequest alloc] initWithClient:client];

  [self registerTrackView:request.sessionId client:client sender:sender];

  [stream registerWithClient:client sessionId:request.sessionId];

  KBRStream *source = [[KBRStream alloc] init];
  source.fd = stream.label;

  KBRStream *sink = [[KBRStream alloc] init];
  sink.fd = stream.label;

  [request pgpEncryptWithSessionID:request.sessionId source:source sink:sink opts:options completion:^(NSError *error) {
    completion(error, stream);
  }];
}

- (void)registerTrackView:(NSInteger)sessionId client:(KBRPClient *)client sender:(id)sender {
  if (!_trackView) {
    _trackView = [[KBUserProfileView alloc] init];
    _trackView.popup = YES;
  }
  [_trackView registerClient:client sessionId:sessionId sender:sender];
}

@end
