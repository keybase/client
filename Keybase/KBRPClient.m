//
//  KBRPClient.m
//  Keybase
//
//  Created by Gabriel on 12/12/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "KBRPClient.h"

#import "KBRObject.h"

#import <GHKit/GHKit.h>
#import <MPMessagePack/MPMessagePack.h>
#import "OSByteOrder.h"

@interface KBRPClient ()
@property (nonatomic) KBRPClientStatus status;
@property NSInputStream *inputStream;
@property NSOutputStream *outputStream;

@property NSMutableArray *queue;
@property NSUInteger writeIndex;

@property NSMutableData *readBuffer;
@end

@implementation KBRPClient

- (instancetype)init {
  if ((self = [super init])) {
    _queue = [NSMutableArray array];
    _readBuffer = [NSMutableData data];
  }
  return self;
}

- (void)open {
  if (_status == KBRPClientStatusOpen || _status == KBRPClientStatusOpenning) return;
  self.status = KBRPClientStatusOpenning;
  CFReadStreamRef readStream;
  CFWriteStreamRef writeStream;
  CFStreamCreatePairWithSocketToHost(NULL, (CFStringRef)@"localhost", 4111111, &readStream, &writeStream);
  
  _inputStream = (__bridge_transfer NSInputStream *)readStream;
  _outputStream = (__bridge_transfer NSOutputStream *)writeStream;
  _inputStream.delegate = self;
  _outputStream.delegate = self;
  [_inputStream scheduleInRunLoop:[NSRunLoop currentRunLoop] forMode:NSDefaultRunLoopMode];
  [_outputStream scheduleInRunLoop:[NSRunLoop currentRunLoop] forMode:NSDefaultRunLoopMode];
  [_inputStream open];
  [_outputStream open];
}

- (void)close {
  [_inputStream close];
  [_inputStream removeFromRunLoop:[NSRunLoop currentRunLoop] forMode:NSDefaultRunLoopMode];
  _inputStream = nil;
  [_outputStream close];
  [_outputStream removeFromRunLoop:[NSRunLoop currentRunLoop] forMode:NSDefaultRunLoopMode];
  _outputStream = nil;
  
  self.status = KBRPClientStatusClosed;
}

- (void)writeObject:(KBRObject *)object {
  NSError *error = nil;
  NSData *data = [MPMessagePackWriter writeObject:object options:0 error:&error];
  [_queue addObject:data];
  [self checkQueue];
}

- (void)readObjectFromData:(NSData *)data {
  NSError *error = nil;
  id obj = [MPMessagePackReader readData:data error:&error];
  [self.delegate client:self didReceiveObject:(KBRObject *)obj];
}

- (void)checkQueue {
  if (![_outputStream hasSpaceAvailable]) return;
  
  NSMutableData *data = [_queue firstObject];
  if (!data) return;

  // TODO: Buffer size
  NSUInteger length = (((data.length - _writeIndex) >= 1024) ? 1024 : (data.length - _writeIndex));
  uint8_t buffer[length];
  [data getBytes:buffer length:length];
  _writeIndex += [_outputStream write:(const uint8_t *)buffer maxLength:length];
}

- (void)checkReadBuffer {
  if (_readBuffer.length < 4) {
    return;
  } else {
    int32_t frameSize = OSReadBigInt32(_readBuffer.bytes, 4);
    if (_readBuffer.length >= frameSize + 4) {
      NSData *frameData = [_readBuffer subdataWithRange:NSMakeRange(4, frameSize)];
      [self readObjectFromData:frameData];
      if (_readBuffer.length > frameSize + 4) {
        _readBuffer = [[_readBuffer subdataWithRange:NSMakeRange(frameSize + 4, _readBuffer.length - (frameSize + 4))] mutableCopy];
        [self checkReadBuffer];
      } else {
        _readBuffer = [NSMutableData data];
      }
    }
  }
}

- (void)setStatus:(KBRPClientStatus)status {
  if (_status != status) {
    _status = status;
    [self.delegate client:self didChangeStatus:_status];
  }
}

- (void)stream:(NSStream *)stream handleEvent:(NSStreamEvent)event {
  switch (event) {
    case NSStreamEventNone: break;
    case NSStreamEventOpenCompleted: {
      if (_status != KBRPClientStatusOpenning) {
        GHErr(@"Status wasn't opening and we got an open completed event");
      }
      self.status = KBRPClientStatusOpen;
      break;
    }
    case NSStreamEventHasSpaceAvailable: {
      [self checkQueue];
      break;
    }        
    case NSStreamEventHasBytesAvailable: {
      // TODO: Buffer size
      uint8_t buffer[1024];
      NSInteger length = [_inputStream read:buffer maxLength:1024];
      [_readBuffer appendBytes:buffer length:length];
      [self checkReadBuffer];
      break;
    }
    case NSStreamEventErrorOccurred: {
      NSError *error = [stream streamError];
      GHErr(@"Stream error: %@", error);
      [self.delegate client:self didError:error];
      [self close];
      break;
    }
    case NSStreamEventEndEncountered: {
      NSData *data = [_outputStream propertyForKey:NSStreamDataWrittenToMemoryStreamKey];
      if (!data) {
        GHErr(@"No data from end event");
      } else {
        [_readBuffer appendData:data];
        [self checkReadBuffer];
      }
      [self close];
      break;
    }
  }
}

@end
