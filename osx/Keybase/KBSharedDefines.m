//
//  KBSharedDefines.m
//  Keybase
//
//  Created by Gabriel on 5/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBSharedDefines.h"


NSNumber *KBNumberFromString(NSString *s) {
  NSInteger n = [s integerValue];
  NSString *s2 = [NSString stringWithFormat:@"%@", @(n)];
  if ([s2 isEqualToString:[s stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceCharacterSet]]) return [NSNumber numberWithInteger:n];
  return nil;
}