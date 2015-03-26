//
//  KBPGPEncrypt.m
//  Keybase
//
//  Created by Gabriel on 3/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPEncrypt.h"

#import "KBUserProfileView.h"

@interface KBPGPEncrypt ()
@property id<KBReader> reader;
@property id<KBWriter> writer;

@property KBUserProfileView *trackView;
@end

@implementation KBPGPEncrypt

- (void)encryptWithOptions:(KBRPgpEncryptOptions *)options reader:(id<KBReader>)reader writer:(id<KBWriter>)writer client:(KBRPClient *)client sender:(id)sender completion:(void (^)(NSError *error))completion {
  NSParameterAssert(reader);
  NSParameterAssert(writer);
  _reader = reader;
  _writer = writer;

  KBRStream *source = [[KBRStream alloc] init];
  source.fd = -1;

  KBRStream *sink = [[KBRStream alloc] init];
  //sink.fd = fileHandleOut.fileDescriptor;
  sink.fd = -2;

  KBRPgpRequest *request = [[KBRPgpRequest alloc] initWithClient:client];

  [self registerTrackView:request.sessionId client:client sender:sender];

  GHWeakSelf gself = self;
  [client registerMethod:@"keybase.1.streamUi.read" sessionId:request.sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
      KBRReadRequestParams *requestParams = [[KBRReadRequestParams alloc] initWithParams:params];
      //NSAssert(requestParams.s.fd == -1, @"Invalid file descriptor");
      NSError *error = nil;
      NSData *data = [gself.reader read:requestParams.sz error:&error];
      //GHDebug(@"Read: %@, %@", @(requestParams.sz), @(data.length));
      dispatch_async(dispatch_get_main_queue(), ^{
        if (error) {
          completion(error, nil);
        } else if (!data) {
          completion(KBMakeError(1504, @"EOF"), nil);
        } else {
          completion(nil, data);
        }
      });
    });
  }];

  [client registerMethod:@"keybase.1.streamUi.write" sessionId:request.sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {

    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
      KBRWriteRequestParams *requestParams = [[KBRWriteRequestParams alloc] initWithParams:params];
      //NSAssert(requestParams.s.fd == fileHandleOut.fileDescriptor, @"Invalid file descriptor");
      //GHDebug(@"Write (%@)", @(requestParams.buf.length));
      //[fileHandleOut writeData:requestParams.buf];
      NSError *error = nil;
      NSInteger numBytes = [gself.writer write:requestParams.buf.bytes maxLength:requestParams.buf.length error:&error];
      dispatch_async(dispatch_get_main_queue(), ^{
        if (numBytes == -1) {
          completion(error, nil);
        } else {
          completion(nil, @(numBytes));
        }
      });
    });
  }];

  [client registerMethod:@"keybase.1.streamUi.close" sessionId:request.sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    [reader close];
    [writer close];
    completion(nil, nil);
  }];

  [request pgpEncryptWithSessionID:request.sessionId source:source sink:sink opts:options completion:^(NSError *error) {
    completion(error);
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
