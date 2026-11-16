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
  return [MPMessagePackWriter writeObject:self error:nil];
}

@end
