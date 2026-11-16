//
//  NSData+MPMessagePack.m
//  MPMessagePack
//
//  Created by Gabriel on 1/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "NSData+MPMessagePack.h"

#import <GHODictionary/GHODictionary.h>

@implementation NSData (MPMessagePack)

- (NSArray *)mp_array:(NSError **)error {
  return [self mp_array:0 error:error];
}

- (NSArray *)mp_array:(MPMessagePackReaderOptions)options error:(NSError **)error {
  id obj = [MPMessagePackReader readData:self error:error];
  if (!obj) return nil;
  if (![obj isKindOfClass:NSArray.class]) {
    if (error) *error = [NSError errorWithDomain:@"MPMessagePack" code:-1 userInfo:@{NSLocalizedDescriptionKey: @"Object was not of type NSArray", @"MPObject": obj}];
    return nil;
  }
  return obj;
}

@end
