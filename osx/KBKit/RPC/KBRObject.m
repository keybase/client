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
  if (![array isKindOfClass:NSArray.class]) return nil;
  for (id obj in array) {
    if (![obj isKindOfClass:clazz]) return nil;
  }
  return array;
}
