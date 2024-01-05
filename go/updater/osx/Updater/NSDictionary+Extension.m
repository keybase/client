//
//  NSDictionary+Extension.m
//  Updater
//
//  Created by Gabriel on 4/19/16.
//  Copyright © 2016 Keybase. All rights reserved.
//

#import "NSDictionary+Extension.h"

@implementation NSDictionary (Extension)

- (BOOL)kb_boolForKey:(id)key withDefault:(BOOL)defaultValue {
  id value = [self objectForKey:key];
  if (!value || [value isEqual:[NSNull null]]) return defaultValue;
  // It can be error prone to check is something is a BOOL object type (NSNumber with internal bool),
  // so we'll use boolValue.
  if (![value respondsToSelector:@selector(boolValue)]) return defaultValue;
  return [value boolValue];
}

- (BOOL)kb_boolForKey:(id)key {
  return [self kb_boolForKey:key withDefault:NO];
}

- (NSString *)kb_stringForKey:(id)key {
  id value = [self objectForKey:key];
  if (!value || [value isEqual:[NSNull null]]) return nil;
  if (![value isKindOfClass:[NSString class]]) return nil;
  return value;
}

- (NSArray<NSString *> *)kb_stringArrayForKey:(id)key {
  id value = [self objectForKey:key];
  if (!value || [value isEqual:[NSNull null]]) return nil;
  if (![value isKindOfClass:[NSArray class]]) return nil;
  for (id obj in value) {
    if (![obj isKindOfClass:NSString.class]) return nil;
  }
  return value;
}

@end
