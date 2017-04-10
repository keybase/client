//
//  KBReader.m
//  Keybase
//
//  Created by Gabriel on 3/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBReader.h"

@interface KBReader ()
@property NSInputStream *inputStream;
@property BOOL open;
@end

@implementation KBReader

+ (instancetype)readerWithData:(NSData *)data {
  NSParameterAssert(data);
  return [KBReader readerWithInputStream:[NSInputStream inputStreamWithData:data]];
}

+ (instancetype)readerWithInputStream:(NSInputStream *)inputStream {
  KBReader *reader = [[KBReader alloc] init];
  reader.inputStream = inputStream;
  return reader;
}

- (NSData *)read:(NSUInteger)length error:(NSError **)error {
  if (!_open) {
    [_inputStream open];
    _open = YES;
  }
  if (length == 0) return [NSData data];
  length = MIN(256 * 1024, length);
  uint8_t buffer[length];
  NSInteger numBytes = [_inputStream read:buffer maxLength:length];
  if (numBytes == 0) return nil; // EOF
  if (numBytes == -1) {
    if (error) *error = [_inputStream streamError];
    return nil;
  }
  return [NSData dataWithBytes:buffer length:numBytes];
}

- (void)close {
  [_inputStream close];
  _inputStream = nil;
}

@end
