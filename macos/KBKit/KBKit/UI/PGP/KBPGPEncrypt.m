//
//  KBPGPEncrypt.m
//  Keybase
//
//  Created by Gabriel on 3/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPEncrypt.h"

#import "KBUserProfileView.h"
#import "KBWork.h"

@interface KBPGPEncrypt ()
@property KBUserProfileView *trackView;
@end

@implementation KBPGPEncrypt

- (void)encryptWithOptions:(KBRPGPEncryptOptions *)options streams:(NSArray *)streams client:(KBRPClient *)client sender:(id)sender completion:(void (^)(NSArray *works, BOOL stop))completion {
  KBRunOver *runOver = [[KBRunOver alloc] init];
  runOver.enumerator = [streams objectEnumerator];
  runOver.runBlock = ^(KBStream *stream, KBRunCompletion runCompletion) {
    [self encryptWithOptions:options stream:stream client:client sender:sender completion:runCompletion];
  };
  runOver.completion = completion;
  [runOver run];
}

- (void)encryptWithOptions:(KBRPGPEncryptOptions *)options stream:(KBStream *)stream client:(KBRPClient *)client sender:(id)sender completion:(KBRunCompletion)completion {
  KBRPgpRequest *request = [[KBRPgpRequest alloc] initWithClient:client];

  [self registerTrackView:request.sessionId client:client sender:sender];

  [stream registerWithClient:client sessionId:request.sessionId];

  KBRStream *source = [[KBRStream alloc] init];
  source.fd = stream.label;

  KBRStream *sink = [[KBRStream alloc] init];
  sink.fd = stream.label;

  [request pgpEncryptWithSource:source sink:sink opts:options completion:^(NSError *error) {
    completion([KBWork workWithInput:stream output:stream error:error], NO);
  }];
}

- (void)registerTrackView:(NSNumber *)sessionId client:(KBRPClient *)client sender:(id)sender {
  NSAssert([sender window], @"No parent window");
  _trackView = [[KBUserProfileView alloc] init];
  _trackView.popup = YES;
  _trackView.fromWindow = [sender window];
  [_trackView registerClient:client sessionId:sessionId];
}

- (void)encryptText:(NSString *)text usernames:(NSArray *)usernames client:(KBRPClient *)client sender:(id)sender completion:(KBRunCompletion)completion {
  KBRPGPEncryptOptions *options = [[KBRPGPEncryptOptions alloc] init];
  id<KBReader> reader = [KBReader readerWithData:[text dataUsingEncoding:NSUTF8StringEncoding]];
  id<KBWriter> writer = [KBWriter writer];

  KBStream *stream = [KBStream streamWithReader:reader writer:writer label:arc4random()];

  options.recipients = usernames;

  KBPGPEncrypt *encrypter = [[KBPGPEncrypt alloc] init];
  [encrypter encryptWithOptions:options streams:@[stream] client:client sender:sender completion:^(NSArray *works) {
    KBWork *work = works[0];
    completion(work, NO); // KBWork
  }];
}

@end
