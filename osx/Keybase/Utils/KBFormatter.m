//
//  KBFormatter.m
//  Keybase
//
//  Created by Gabriel on 5/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFormatter.h"

#import <ObjectiveSugar/ObjectiveSugar.h>

@interface KBFormatter (NSDictionaryCreation)
- (NSDictionary *)toDictionary;
@end


@implementation KBFormatter

- (NSString *)format:(id)obj {
  return [self format:obj level:-1];
}

- (NSString *)format:(id)obj level:(NSInteger)level {
  if (!obj) {
    return @"null";
  } else if (obj == (void*)kCFBooleanTrue) {
    return @"true";
  } else if (obj == (void*)kCFBooleanFalse) {
    return @"false";
  } else if ([obj isKindOfClass:NSNull.class]) {
    return @"NSNull";
  } else if ([obj isKindOfClass:NSString.class]) {
    return NSStringWithFormat(@"\"%@\"", obj);
  } else if ([obj isKindOfClass:NSArray.class]) {
    return [self formatArray:obj level:level];
  } else if ([obj isKindOfClass:GHODictionary.class]) {
    return [self formatDictionary:obj level:level+1];
  } else if ([obj isKindOfClass:NSDictionary.class]) {
    return [self formatDictionary:obj level:level+1];
  } else if ([obj respondsToSelector:@selector(toDictionary)]) {
    id dict = [obj toDictionary];
    return [self formatDictionary:dict level:level+1];
  //} else if ([obj isKindOfClass:NSData.class]) {
  //  return KBHexString(obj, @"");
  } else {
    return [obj description];
  }
}

- (NSString *)formatArray:(NSArray *)array level:(NSInteger)level {
  if (!array) return @"null";
  if ([array count] == 0) return @"[]";

  NSString *astr = [[array map:^(id obj) { return [self format:obj level:level]; }] join:@", "];
  return NSStringWithFormat(@"[%@]", astr);
}

- (NSString *)formatDictionary:(id)dict level:(NSInteger)level {
  if (!dict) return @"";
  if ([dict count] == 0) return @"{}";
  NSString *prefix = [@"" stringByPaddingToLength:(level+1)*2 withString:@" " startingAtIndex:0];
  NSString *endPrefix = [@"" stringByPaddingToLength:level*2 withString:@" " startingAtIndex:0];
  NSString *str = NSStringWithFormat(@"{\n%@%@\n%@}", prefix, [[dict map:^id(id key, id value) {
    return NSStringWithFormat(@"%@: %@", [self format:key level:level], [self format:value level:level]);
  }] join:NSStringWithFormat(@",\n%@", prefix)], endPrefix);
  return str;
}

@end

NSString *KBDescription(id obj) {
  KBFormatter *formatter = [[KBFormatter alloc] init];
  return [formatter format:obj];
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
