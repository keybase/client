//
//  KBRObject.m
//  Keybase
//
//  Created by Gabriel on 12/11/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "KBRObject.h"
#import <Mantle/Mantle.h>
#import <objc/objc-runtime.h>

@implementation KBRObject

+ (NSString *)classNameOfPropertyNamed:(NSString *)propertyName {
  objc_property_t property = class_getProperty(self, propertyName.UTF8String);
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

+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{}; }

+ (NSValueTransformer *)JSONTransformerForKey:(NSString *)key {
  NSString *className = [self classNameOfPropertyNamed:key];
  if (className) {
    Class clazz = NSClassFromString(className);
    if ([clazz isSubclassOfClass:MTLModel.class]) {
      return [NSValueTransformer mtl_JSONDictionaryTransformerWithModelClass:clazz];
    }
  }
  return nil;
}

@end
