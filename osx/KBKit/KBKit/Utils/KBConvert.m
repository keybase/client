//
//  KBConvert.m
//  Keybase
//
//  Created by Gabriel on 6/10/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "KBConvert.h"

#import <ObjectiveSugar/ObjectiveSugar.h>
#import <GHKit/GHKit.h>
#import "KBFormatter.h"

NSString *KBConvertObjectToString(id obj) {
  if (!obj) return nil;
  return NSStringWithFormat(@"<Data:%@>", KBHexString(obj, @""));
}

id KBConvertStringToObject(NSString *str) {
  if ([str gh_startsWith:@"<Data:"]) {
    return KBHexData([str substringWithRange:NSMakeRange(7, str.length - 8)]);
  }
  return nil; // No conversion
}

void KBConvertArrayTo(NSMutableArray *array) {
  KBConvertArray(array, NSData.class, ^id(NSData *data) { return KBConvertObjectToString(data); });
}

void KBConvertArrayFrom(NSMutableArray *array) {
  KBConvertArray(array, NSString.class, ^id(NSString *str) { return KBConvertStringToObject(str); });
}

void KBConvertDictTo(NSMutableDictionary *dict) {
  KBConvertDict(dict, NSData.class, ^id(NSData *data) { return KBConvertObjectToString(data); });
}

void KBConvertDictFrom(NSMutableDictionary *dict) {
  KBConvertDict(dict, NSString.class, ^id(NSString *str) { return KBConvertStringToObject(str); });
}

typedef id (^KBCoverter)(id obj);

void KBConvertArray(NSMutableArray *array, Class clazz, KBCoverter converter) {
  for (NSInteger i = 0; i < array.count; i++) {
    id item = array[i];
    id converted = KBConvertObject(item, clazz, converter);
    if (converted) array[i] = converted;
  }
}

void KBConvertDict(NSMutableDictionary *dict, Class clazz, KBCoverter converter) {
  for (NSString *key in [dict allKeys]) {
    id item = dict[key];
    id converted = KBConvertObject(item, clazz, converter);
    if (converted) dict[key] = converted;
  }
}

id KBConvertObject(id item, Class clazz, KBCoverter converter) {
  if ([item isKindOfClass:NSMutableArray.class]) {
    KBConvertArray(item, clazz, converter);
  } else if ([item isKindOfClass:NSArray.class]) {
    NSMutableArray *itemCopy = (NSMutableArray *)CFBridgingRelease(CFPropertyListCreateDeepCopy(kCFAllocatorDefault, (CFArrayRef)item, kCFPropertyListMutableContainers));
    KBConvertArray(itemCopy, clazz, converter);
  } else if ([item isKindOfClass:NSMutableDictionary.class]) {
    KBConvertDict(item, clazz, converter);
  } else if ([item isKindOfClass:NSDictionary.class]) {
    //NSCAssert(NO, @"Not mutable dict");
    NSMutableDictionary *itemCopy = (NSMutableDictionary *)CFBridgingRelease(CFPropertyListCreateDeepCopy(kCFAllocatorDefault, (CFDictionaryRef)item, kCFPropertyListMutableContainers));
    KBConvertDict(itemCopy, clazz, converter);
  } else if ([item isKindOfClass:clazz]) {
    return converter(item);
  }
  return nil;
}
