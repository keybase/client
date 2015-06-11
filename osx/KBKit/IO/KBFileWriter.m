//
//  KBFileWriter.m
//  Keybase
//
//  Created by Gabriel on 3/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFileWriter.h"

@interface KBFileWriter ()
@property NSOutputStream *output;
@property BOOL open;
@property NSString *path;
@end

@implementation KBFileWriter

+ (instancetype)fileWriterWithPath:(NSString *)path {
  KBFileWriter *writer = [[self alloc] init];
  writer.output = [NSOutputStream outputStreamToFileAtPath:path append:NO];
  writer.path = path;
  return writer;
}

+ (instancetype)writerWithOutputStream:(NSOutputStream *)outputStream {
  KBFileWriter *writer = [[self alloc] init];
  writer.output = outputStream;
  return writer;
}

- (NSInteger)write:(const uint8_t *)buffer maxLength:(NSUInteger)maxLength error:(NSError **)error {
  NSAssert(_output, @"No output stream");
  if (!_open) {
    [_output open];
    _open = YES;
  }
  NSInteger numBytes = [_output write:buffer maxLength:maxLength];
  if (numBytes == -1) {
    if (error) *error = [_output streamError];
  }
  return numBytes;
}

- (void)close {
  [_output close];
  _output = nil;
  _open = NO;
}

- (NSData *)data {
  return nil;
}

@end
