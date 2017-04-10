//
//  KBRObject.m
//  Keybase
//
//  Created by Gabriel on 12/11/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "KBRObject.h"

#import <GHODictionary/GHODictionary.h>
#import "KBFormatter.h"

@implementation KBRObject

+ (NSDictionary *)JSONKeyPathsByPropertyKey {
  NSArray *propertyNames = KBPropertyNames(self);
  NSMutableDictionary *dict = [NSMutableDictionary dictionaryWithCapacity:[propertyNames count]];
  for (NSString *propertyName in propertyNames) {
    dict[propertyName] = propertyName;
  }
  return dict;
}

+ (NSValueTransformer *)JSONTransformerForKey:(NSString *)key {
  NSString *className = KBClassNameOfPropertyNamed(self, key);
  if (className) {
    Class clazz = NSClassFromString(className);
    if ([clazz isSubclassOfClass:MTLModel.class]) {
      return [MTLJSONAdapter dictionaryTransformerWithModelClass:clazz];
    }
  }
  return nil;
}

- (GHODictionary *)toDictionary {
  NSDictionary *dict = [MTLJSONAdapter JSONDictionaryFromModel:self error:nil]; // TODO: Handle error
  GHODictionary *odict = [GHODictionary dictionaryWithDictionary:dict];
  [odict sortKeysUsingSelector:@selector(localizedCaseInsensitiveCompare:) deepSort:YES];
  return odict;
}

@end


NSArray *KBRValidateArray(id array, Class clazz) {
  // TODO: Only in debug
  if (![array isKindOfClass:NSArray.class]) return nil;
  for (id obj in array) {
    if (![obj isKindOfClass:clazz]) return nil;
  }
  return array;
}

NSDictionary *KBRValidateDictionary(id dict, Class clazz) {
  // TODO: Only in debug
  if (![dict isKindOfClass:NSDictionary.class]) return nil;
  __block BOOL failed = NO;
  [dict enumerateKeysAndObjectsUsingBlock:^(id key, id value, BOOL* stop) {
    if (![key isKindOfClass:NSString.class] || ![value isKindOfClass:clazz]) {
      failed = YES;
      *stop = YES;
    }
  }];
  if (failed) return nil;
  return dict;
}
