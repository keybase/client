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

NSString *KBDir(NSString *dir, BOOL tilde) {
  return tilde ? [dir stringByAbbreviatingWithTildeInPath] : [dir stringByExpandingTildeInPath];
}

NSString *KBHexString(NSData *data, NSString *defaultValue) {
  if (!data) return defaultValue;
  if ([data length] == 0) return defaultValue;
  NSMutableString *hexString = [NSMutableString stringWithCapacity:[data length] * 2];
  for (NSUInteger i = 0; i < [data length]; ++i) {
    [hexString appendFormat:@"%02X", *((uint8_t *)[data bytes] + i)];
  }
  return [hexString lowercaseString];
}

NSData *KBHexData(NSString *s) {
  if ((s.length % 2) != 0) {
    return nil;
  }

  const char *chars = [s UTF8String];
  NSMutableData *data = [NSMutableData dataWithCapacity:s.length / 2];
  char byteChars[3] = {0, 0, 0};
  unsigned long wholeByte;

  for (int i = 0; i < s.length; i += 2) {
    byteChars[0] = chars[i];
    byteChars[1] = chars[i + 1];
    wholeByte = strtoul(byteChars, NULL, 16);
    [data appendBytes:&wholeByte length:1];
  }

  return data;
}
