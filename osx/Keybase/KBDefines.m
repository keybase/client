//
//  KBSharedDefines.m
//  Keybase
//
//  Created by Gabriel on 5/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBDefines.h"


NSNumber *KBNumberFromString(NSString *s) {
  NSInteger n = [s integerValue];
  NSString *s2 = [NSString stringWithFormat:@"%@", @(n)];
  if ([s2 isEqualToString:[s stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceCharacterSet]]) return [NSNumber numberWithInteger:n];
  return nil;
}

NSString *KBNSStringWithFormat(NSString *formatString, ...) {
  va_list args;
  va_start(args, formatString);
  NSString *string = [[NSString alloc] initWithFormat:formatString arguments:args];
  va_end(args);
  return string;
}



BOOL KBIsErrorName(NSError *error, NSString *name) {
  return [error.userInfo[@"MPErrorInfoKey"][@"name"] isEqualTo:name];
}

NSString *KBPath(NSString *path, BOOL tilde, BOOL escape) {
  if (!path) return nil;
  path = tilde ? [path stringByAbbreviatingWithTildeInPath] : [path stringByExpandingTildeInPath];
  if (escape) path = [path stringByReplacingOccurrencesOfString:@" " withString:@"\\ "];
  return path;
}

