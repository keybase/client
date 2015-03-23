//
//  KBReadBuffer.m
//  Keybase
//
//  Created by Gabriel on 3/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBReadBuffer.h"

@interface KBReadBuffer ()
@property NSData *data;
@property NSInteger readIndex;
@end

@implementation KBReadBuffer

+ (instancetype)bufferWithData:(NSData *)data {
  KBReadBuffer *buffer = [[KBReadBuffer alloc] init];
  buffer.data = data;
  return buffer;
}

- (NSData *)read:(NSInteger)length {
  if (length == 0) return nil;
  if (length + _readIndex > _data.length) length = _data.length - _readIndex;
  if (length == 0) return nil;
  NSData *data = [_data subdataWithRange:NSMakeRange(_readIndex, length)];
  _readIndex += length;
  return data;
}

@end
