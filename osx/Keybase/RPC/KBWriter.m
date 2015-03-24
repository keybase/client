//
//  KBWriteBuffer.m
//  Keybase
//
//  Created by Gabriel on 3/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBWriter.h"

@interface KBWriter ()
@property NSMutableData *data;
@end

@implementation KBWriter

+ (instancetype)writer {
  KBWriter *writer = [[self alloc] init];
  writer.data = [NSMutableData data]; // TODO capacity
  return writer;
}

- (NSInteger)write:(const uint8_t *)buffer maxLength:(NSUInteger)maxLength error:(NSError **)error {
  [_data appendBytes:buffer length:maxLength];
  return maxLength;
}

- (void)close {
  // Nothing
}

@end
