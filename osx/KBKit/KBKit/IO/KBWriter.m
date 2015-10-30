//
//  KBWriteBuffer.m
//  Keybase
//
//  Created by Gabriel on 3/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBWriter.h"

@interface KBWriter ()
@property NSMutableData *mdata;
@end

@implementation KBWriter

+ (instancetype)writer {
  return [[self alloc] init];
}

- (NSInteger)write:(const uint8_t *)buffer maxLength:(NSUInteger)maxLength error:(NSError **)error {
  if (!_mdata) _mdata = [NSMutableData data];
  [_mdata appendBytes:buffer length:maxLength];
  return maxLength;
}

- (NSData *)data {
  return _mdata;
}

- (NSString *)path {
  return nil;
}

- (void)close {
  // Nothing
}

@end
