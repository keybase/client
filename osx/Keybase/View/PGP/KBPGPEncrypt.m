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
//@property NSArray *streams;
@property KBUserProfileView *trackView;
@end

@implementation KBPGPEncrypt

- (void)encryptWithOptions:(KBRPgpEncryptOptions *)options streams:(NSArray *)streams client:(KBRPClient *)client sender:(id)sender completion:(void (^)(NSError *error))completion {
  //_streams = streams;

  //GHWeakSelf gself = self;
  KBSerialBox *sb = [[KBSerialBox alloc] init];
  sb.objects = streams;
  sb.runBlock = ^(KBStream *stream, BOOL finished, KBCompletionHandler runCompletion) {
    [self encryptWithOptions:options stream:stream client:client sender:sender completion:^(NSError *error) {
      runCompletion(error);
    }];
  };
  sb.completionBlock = ^(NSArray *objs) {
    //gself.streams = nil;
    completion(nil);
  };
  [sb run];
}


- (void)encryptWithOptions:(KBRPgpEncryptOptions *)options stream:(KBStream *)stream client:(KBRPClient *)client sender:(id)sender completion:(void (^)(NSError *error))completion {
  KBRPgpRequest *request = [[KBRPgpRequest alloc] initWithClient:client];

  [self registerTrackView:request.sessionId client:client sender:sender];

  //GHWeakSelf gself = self;
  [client registerMethod:@"keybase.1.streamUi.read" sessionId:request.sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
      KBRReadRequestParams *requestParams = [[KBRReadRequestParams alloc] initWithParams:params];
      NSAssert(requestParams.s.fd == stream.label, @"Invalid file descriptor");
      NSError *error = nil;
      NSData *data = [stream.reader read:requestParams.sz error:&error];
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
      NSAssert(requestParams.s.fd == stream.label, @"Invalid file descriptor");
      //GHDebug(@"Write (%@)", @(requestParams.buf.length));
      //[fileHandleOut writeData:requestParams.buf];
      NSError *error = nil;
      NSInteger numBytes = requestParams.buf.length > 0 ? [stream.writer write:requestParams.buf.bytes maxLength:requestParams.buf.length error:&error] : 0;
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
    [stream.reader close];
    [stream.writer close];
    completion(nil, nil);
  }];

  KBRStream *source = [[KBRStream alloc] init];
  source.fd = stream.label;

  KBRStream *sink = [[KBRStream alloc] init];
  sink.fd = stream.label;

  // TODO: Should copy options first
  options.binaryOut = stream.binary;

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
