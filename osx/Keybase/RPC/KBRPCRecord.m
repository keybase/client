//
//  KBRPCRecord.m
//  Keybase
//
//  Created by Gabriel on 3/4/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBRPCRecord.h"

#import <ObjectiveSugar/ObjectiveSugar.h>
#import <GHKit/GHKit.h>

#import "AppDelegate.h"

@interface KBRPCRecord ()
@property NSString *recordId;
@property NSInteger methodIndex;

@property NSMutableDictionary *sessionDirectory;
@property NSInteger lastSessionId;
@end

@implementation KBRPCRecord

- (instancetype)init {
  if ((self = [super init])) {
    _recordId = [[NSDate date] gh_formatISO8601];
    _sessionDirectory = [NSMutableDictionary dictionary];
  }
  return self;
}

- (void)recordRequest:(NSString *)method params:(NSArray *)params sessionId:(NSInteger)sessionId callback:(BOOL)callback {
  [self recordMethod:method data:[self convert:params] sessionId:sessionId label:@"request" callback:callback];
}

- (void)recordResponse:(NSString *)method response:(id)response sessionId:(NSInteger)sessionId {
  [self recordMethod:method data:[self convert:response] sessionId:sessionId label:@"response" callback:NO];
}

- (id)convert:(id)obj {
  if ([obj isKindOfClass:NSArray.class]) {
    NSMutableArray *objCopy = [[NSKeyedUnarchiver unarchiveObjectWithData:[NSKeyedArchiver archivedDataWithRootObject:obj]] mutableCopy];
    KBConvertArrayTo(objCopy);
    return objCopy;
  } else if ([obj isKindOfClass:NSDictionary.class]) {
    NSMutableDictionary *objCopy = [[NSKeyedUnarchiver unarchiveObjectWithData:[NSKeyedArchiver archivedDataWithRootObject:obj]] mutableCopy];
    KBConvertDictTo(objCopy);
    return objCopy;
  }
  return obj;
}

- (void)recordMethod:(NSString *)method data:(id)data sessionId:(NSInteger)sessionId label:(NSString *)label callback:(BOOL)callback {
  // Skip some methods
  if ([method isEqualToString:@"keybase.1.logUi.log"]) return;

  NSInteger index = _methodIndex++;
  // TODO Remove when session ids are on every request
  if (callback) {
    if (sessionId == 0) {
      sessionId = _lastSessionId;
    }
  } else {
    _lastSessionId = sessionId;
  }

  NSString *sessionDirectory;
  if (callback) {
    sessionDirectory = _sessionDirectory[@(sessionId)];
    NSAssert(sessionDirectory, @"No current session for callback");
  } else {
    NSNumberFormatter *indexFormatter = [[NSNumberFormatter alloc] init];
    [indexFormatter setFormatWidth:4];
    [indexFormatter setPaddingCharacter:@"0"];

    sessionDirectory = [@[[indexFormatter stringFromNumber:@(sessionId)], method] join:@"-"];
    //NSAssert(!_sessionDirectory[@(sessionId)], @"Existing session directory");
    _sessionDirectory[@(sessionId)] = sessionDirectory;
  }

  NSString *directory = [AppDelegate applicationSupport:@[@"Recording", _recordId, sessionDirectory] create:YES error:nil];
  NSNumberFormatter *indexFormatter = [[NSNumberFormatter alloc] init];
  [indexFormatter setFormatWidth:4];
  [indexFormatter setPaddingCharacter:@"0"];

  NSString *file = NSStringWithFormat(@"%@--%@--%@.json", [indexFormatter stringFromNumber:@(index)], method, label);
  NSError *error = nil;
  NSData *JSONData = [NSJSONSerialization dataWithJSONObject:data options:NSJSONWritingPrettyPrinted error:&error];
  NSString *JSONFile = [directory stringByAppendingPathComponent:file];
  [JSONData writeToFile:JSONFile atomically:YES];
}

@end

void KBConvertArrayTo(NSMutableArray *array) {
  KBConvertArray(array, NSData.class, ^id(NSData *data) {
    if (!data) return nil;
    return NSStringWithFormat(@"Binary-%@", KBHexString(data));
  });
}

void KBConvertArrayFrom(NSMutableArray *array) {
  KBConvertArray(array, NSString.class, ^id(NSString *str) {
    if ([str isEqualTo:@"Binary-(null)"]) return [NSData data];
    if (![str gh_startsWith:@"Binary-"]) return nil;
    return KBHexData([str substringFromIndex:6]);
  });
}

void KBConvertDictTo(NSMutableDictionary *dict) {
  KBConvertDict(dict, NSData.class, ^id(NSData *data) {
    if (!data) return nil;
    return NSStringWithFormat(@"Binary-%@", KBHexString(data));
  });
}

void KBConvertDictFrom(NSMutableDictionary *dict) {
  KBConvertDict(dict, NSString.class, ^id(NSString *str) {
    if ([str isEqualTo:@"Binary-(null)"]) return [NSData data];
    if (![str gh_startsWith:@"Binary-"]) return nil;
    return KBHexData([str substringFromIndex:6]);
  });
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
