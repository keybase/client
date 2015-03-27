//
//  KBStream.m
//  Keybase
//
//  Created by Gabriel on 3/26/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBStream.h"

@implementation KBStream

- (int)label {
  if (!_label) _label = arc4random_uniform(INT_MAX);
  return _label;
}

+ (instancetype)streamWithReader:(id<KBReader>)reader writer:(id<KBWriter>)writer binary:(BOOL)binary {
  KBStream *stream = [[KBStream alloc] init];
  stream.reader = reader;
  stream.writer = writer;
  stream.binary = binary;
  return stream;
}

@end
