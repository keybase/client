//
//  KBAppDefines.m
//  Keybase
//
//  Created by Gabriel on 1/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBAppDefines.h"

NSString *const KBTrackingListDidChangeNotification = @"KBTrackingListDidChangeNotification";
NSString *const KBStatusDidChangeNotification = @"KBStatusDidChangeNotification";

NSString *KBDescriptionForKID(NSData *kid) {
  if (!kid) return nil;
  if ([kid length] < 16) return [KBHexString(kid, @"") uppercaseString];
  return [KBHexString([kid subdataWithRange:NSMakeRange(kid.length-16, 16)], @"") uppercaseString];
}

NSString *KBPGPKeyIdFromFingerprint(NSString *fingerprint) {
  if (!fingerprint) return nil;
  if ([fingerprint length] < 16) return fingerprint;
  return [[fingerprint substringFromIndex:[fingerprint length] - 16] lowercaseString];
}

NSString *KBDescriptionForFingerprint(NSString *fingerprint, NSInteger indexForLineBreak) {
  NSMutableString *s = [[NSMutableString alloc] init];
  for (NSInteger i = 1; i <= fingerprint.length; i++) {
    [s appendString:[NSString stringWithFormat:@"%c", [fingerprint characterAtIndex:i-1]]];
    if (indexForLineBreak == i) {
      [s appendString:@"\n"];
    } else {
      if (i % 4 == 0) [s appendString:@" "];
    }
  }
  return [s uppercaseString];
}

NSString *KBDisplayURLStringForUsername(NSString *username) {
  return NSStringWithFormat(@"keybase.io/%@", username);
}

NSString *KBURLStringForUsername(NSString *username) {
  return NSStringWithFormat(@"https://keybase.io/%@", username);
}

NSString *KBNSStringByStrippingHTML(NSString *str) {
  if (!str) return nil;
  NSRange r;
  while ((r = [str rangeOfString:@"<[^>]+>" options:NSRegularExpressionSearch]).location != NSNotFound)
    str = [str stringByReplacingCharactersInRange:r withString:@""];
    return str;
}

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
