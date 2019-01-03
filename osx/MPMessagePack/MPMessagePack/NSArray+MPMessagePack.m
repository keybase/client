//
//  NSArray+MPMessagePack.m
//  MPMessagePack
//
//  Created by Gabriel on 7/3/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "NSArray+MPMessagePack.h"

@implementation NSArray (MPMessagePack)

- (NSData *)mp_messagePack {
  return [self mp_messagePack:0];
}

- (NSData *)mp_messagePack:(MPMessagePackWriterOptions)options {
  return [MPMessagePackWriter writeObject:self options:options error:nil];
}

- (NSData *)mp_messagePack:(MPMessagePackWriterOptions)options error:(NSError **)error {
  return [MPMessagePackWriter writeObject:self options:options error:error];
}

@end
