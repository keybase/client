//
//  KBRObject.m
//  Keybase
//
//  Created by Gabriel on 12/11/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "KBRObject.h"

#import <objc/runtime.h>

static NSArray *KBPropertyNames(Class clazz) {
  unsigned int count;
  objc_property_t *properties = class_copyPropertyList(clazz, &count);
  NSMutableArray *propertyNames = [NSMutableArray arrayWithCapacity:count];
  for (NSUInteger i = 0; i < count; i++) {
    objc_property_t property = properties[i];
    const char *propName = property_getName(property);
    NSString *propertyName = [NSString stringWithCString:propName encoding:NSUTF8StringEncoding];
    [propertyNames addObject:propertyName];
  }
  free(properties);
  return propertyNames;
}

static NSString *KBClassNameOfPropertyNamed(Class clazz, NSString *propertyName) {
  objc_property_t property = class_getProperty(clazz, propertyName.UTF8String);
  NSString *propertyAttributes = [NSString stringWithCString:property_getAttributes(property) encoding:NSUTF8StringEncoding];
  NSArray *splitPropertyAttributes = [propertyAttributes componentsSeparatedByString:@","];
  if (splitPropertyAttributes.count > 0) {
    // xcdoc://ios//library/prerelease/ios/documentation/Cocoa/Conceptual/ObjCRuntimeGuide/Articles/ocrtPropertyIntrospection.html
    NSString *encodeType = splitPropertyAttributes[0];
    NSArray *splitEncodeType = [encodeType componentsSeparatedByString:@"\""];
    if (splitEncodeType.count > 1) {
      NSString *className = splitEncodeType[1];
      return className;
    }
  }
  return nil;
}

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

@end
