//
//  KBStream.m
//  Keybase
//
//  Created by Gabriel on 3/26/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBStream.h"
#import "KBFileReader.h"
#import "KBFileWriter.h"
#import "KBFile.h"

typedef BOOL (^KBAddToStream)(NSString *outPath, NSMutableArray *streams, KBCompletion completion);

@interface KBStream ()
@property id<KBReader> reader;
@property id<KBWriter> writer;
@property u_int32_t label;
@end

@implementation KBStream

+ (instancetype)streamWithReader:(id<KBReader>)reader writer:(id<KBWriter>)writer label:(int)label {
  KBStream *stream = [[KBStream alloc] init];
  stream.reader = reader;
  stream.writer = writer;
  stream.label = label;
  return stream;
}

- (void)registerWithClient:(KBRPClient *)client sessionId:(NSNumber *)sessionId {
  [client registerMethod:@"keybase.1.streamUi.read" sessionId:sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    [self RPCReadWithParams:params completion:completion];
  }];

  [client registerMethod:@"keybase.1.streamUi.write" sessionId:sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    [self RPCWriteWithParams:params completion:completion];
  }];

  [client registerMethod:@"keybase.1.streamUi.close" sessionId:sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    [self close];
    completion(nil, nil);
  }];
}

- (void)RPCReadWithParams:(NSArray *)params completion:(MPRequestCompletion)completion {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    KBRReadRequestParams *requestParams = [[KBRReadRequestParams alloc] initWithParams:params];
    NSAssert(requestParams.s.fd == self.label, @"Invalid file descriptor");
    NSError *error = nil;
    NSData *data = [self.reader read:requestParams.sz error:&error];
    //DDLogDebug(@"Read: %@, %@", @(requestParams.sz), @(data.length));
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
}

- (void)RPCWriteWithParams:(NSArray *)params completion:(MPRequestCompletion)completion {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    KBRWriteRequestParams *requestParams = [[KBRWriteRequestParams alloc] initWithParams:params];
    NSAssert(requestParams.s.fd == self.label, @"Invalid file descriptor");
    //DDLogDebug(@"Write (%@)", @(requestParams.buf.length));
    //[fileHandleOut writeData:requestParams.buf];
    NSError *error = nil;
    NSInteger numBytes = requestParams.buf.length > 0 ? [self.writer write:requestParams.buf.bytes maxLength:requestParams.buf.length error:&error] : 0;
    dispatch_async(dispatch_get_main_queue(), ^{
      if (numBytes == -1) {
        completion(error, nil);
      } else {
        completion(nil, @(numBytes));
      }
    });
  });
}

- (void)close {
  [self.reader close];
  [self.writer close];
}

+ (void)checkFiles:(NSArray */*of KBFile*/)files index:(NSInteger)index output:(KBFileOutput)output streams:(NSMutableArray *)streams skipCheck:(BOOL)skipCheck view:(NSView *)view completion:(KBCompletion)completion {
  if (index >= [files count]) {
    completion(nil);
    return;
  }
  KBFile *file = files[index];
  KBFileReader *fileReader = [KBFileReader fileReaderWithPath:file.path];
  NSString *outPath = output(file.path);
  KBFileWriter *fileWriter = [KBFileWriter fileWriterWithPath:outPath];
  KBStream *stream = [KBStream streamWithReader:fileReader writer:fileWriter label:arc4random()];

  KBAddToStream addToStream = ^BOOL(NSString *outPath, NSMutableArray *streams, KBCompletion completion) {
    NSError *error = nil;
    if ([NSFileManager.defaultManager fileExistsAtPath:outPath isDirectory:NO]) {
      if (![NSFileManager.defaultManager removeItemAtPath:outPath error:&error]) {
        completion(error);
        return NO;
      }
    }
    [streams addObject:stream];
    return YES;
  };

  if (!skipCheck && [NSFileManager.defaultManager fileExistsAtPath:outPath isDirectory:NO]) {
    [KBFile promptOverwrite:outPath view:view completion:^(KBFileResponse response) {
      BOOL bSkipCheck = skipCheck;
      switch (response) {
        case KBFileResponseSkip:
          break;
        case KBFileResponseCancel:
          [streams removeAllObjects];
          completion(nil);
          return;
        case KBFileResponseOverwrite: {
          if (!addToStream(outPath, streams, completion)) return;
          break;
        }
        case KBFileResponseOverwriteAll:
          if (!addToStream(outPath, streams, completion)) return;
          bSkipCheck = YES;
          break;
      }
      [self checkFiles:files index:index+1 output:output streams:streams skipCheck:bSkipCheck view:view completion:completion];
    }];
  } else {
    if (!addToStream(outPath, streams, completion)) return;
    [self checkFiles:files index:index+1 output:output streams:streams skipCheck:skipCheck view:view completion:completion];
  }
}

@end
