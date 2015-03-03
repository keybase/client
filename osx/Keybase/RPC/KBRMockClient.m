//
//  KBRMockClient.m
//  Keybase
//
//  Created by Gabriel on 2/25/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBRMockClient.h"

#import <MPMessagePack/MPMessagePack.h>
#import "AppDelegate.h"
#import "KBRPCRegistration.h"

@interface KBRMockClient ()
@property NSInteger methodIndex;
@property NSString *recordId;
@property NSMutableDictionary *registrations;
@end

@implementation KBRMockClient

- (instancetype)init {
  if ((self = [super init])) {
    _recordId = [[NSDate date] gh_formatISO8601];
  }
  return self;
}

- (NSInteger)nextSessionId {
  static NSInteger gSessionId = 0;
  return ++gSessionId;
}

- (NSArray *)sendRequestWithMethod:(NSString *)method params:(NSArray *)params sessionId:(NSInteger)sessionId completion:(MPRequestCompletion)completion {
  self.completion = completion;
  if (self.handler) self.handler(@(sessionId), method, params, completion);
  return @[@(0), @(sessionId), method, params];
}

- (void)registerMethod:(NSString *)method sessionId:(NSInteger)sessionId requestHandler:(MPRequestHandler)requestHandler {
  if (!self.registrations) self.registrations = [NSMutableDictionary dictionary];
  KBRPCRegistration *registration = self.registrations[@(sessionId)];
  if (!registration) {
    registration = [[KBRPCRegistration alloc] init];
    self.registrations[@(sessionId)] = registration;
  }
  [registration registerMethod:method requestHandler:requestHandler];
}

- (void)unregister:(NSInteger)sessionId {
  [self.registrations removeObjectForKey:@(sessionId)];
}

- (void)replayRecordId:(NSString *)recordId {
  GHWeakSelf gself = self;
  NSString *directory = [AppDelegate applicationSupport:@[@"Record", recordId] create:NO error:nil];
  NSArray *files = [NSFileManager.defaultManager contentsOfDirectoryAtPath:directory error:nil];

  if (files.count == 0) {
    return;
  }

  NSMutableDictionary *fileDict = [NSMutableDictionary dictionary];
  NSInteger start = NSIntegerMax;
  NSInteger end = 0;
  for (NSString *file in files) {
    NSArray *split = [file split:@"--"];
    if (split.count != 2) continue;
    NSInteger index = [split[0] integerValue];

    if (index < start) start = index;
    if (index > end) end = index;

    NSString *method = [split[1] substringToIndex:[split[1] length] - 5];
    fileDict[@(index)] = @{@"file": file, @"method": method};
  }

  for (NSInteger index = start; index <= end; index++) {
    NSString *file = fileDict[@(index)][@"file"];
    NSString *method = fileDict[@(index)][@"method"];
    id params = [NSJSONSerialization JSONObjectWithData:[NSData dataWithContentsOfFile:NSStringWithFormat(@"%@/%@", directory, file)] options:NSJSONReadingMutableContainers error:nil];
    KBConvertArrayFrom(params);
    GHDebug(@"Replay %@", method);
    for (id key in gself.registrations) {
      KBRPCRegistration *registration = gself.registrations[key];
      MPRequestHandler completion = [registration requestHandlerForMethod:method];
      if (completion) completion(nil, method, params, ^(NSError *error, id result) { });
    }
  }
}

- (void)recordMethod:(NSString *)method params:(NSArray *)params {
  NSInteger index = _methodIndex++;
  [AppDelegate applicationSupport:@[@"Record", _recordId] create:YES error:nil];
  NSNumberFormatter *indexFormatter = [[NSNumberFormatter alloc] init];
  [indexFormatter setFormatWidth:4];
  [indexFormatter setPaddingCharacter:@"0"];

  NSString *file = NSStringWithFormat(@"%@--%@.json", [indexFormatter stringFromNumber:@(index)], method);
  NSMutableArray *paramsCopy = [[NSKeyedUnarchiver unarchiveObjectWithData: [NSKeyedArchiver archivedDataWithRootObject:params]] mutableCopy];
  KBConvertArrayTo(paramsCopy);
  [[NSJSONSerialization dataWithJSONObject:paramsCopy options:NSJSONWritingPrettyPrinted error:nil] writeToFile:file atomically:NO];
}


+ (id)paramsFromRecordId:(NSString *)recordId file:(NSString *)file {
  NSString *path = [AppDelegate applicationSupport:@[@"Record", recordId, file] create:NO error:nil];
  NSData *data = [NSData dataWithContentsOfFile:path];
  NSAssert(data, @"No data found at %@", path);
  id params = [NSJSONSerialization JSONObjectWithData:data options:NSJSONReadingMutableContainers error:nil];
  KBConvertArrayFrom(params);
  return params;
}

void KBConvertArrayTo(NSMutableArray *array) {
  KBConvertArray(array, NSData.class, ^id(NSData *data) {
    return NSStringWithFormat(@"Binary-%@", [data na_hexString]);
  });
}

void KBConvertArrayFrom(NSMutableArray *array) {
  KBConvertArray(array, NSString.class, ^id(NSString *str) {
    if (![str gh_startsWith:@"Binary-"]) return nil;
    return [[str substringFromIndex:6] na_dataFromHexString];
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
    NSCAssert(NO, @"Not mutable array");
  } else if ([item isKindOfClass:NSMutableDictionary.class]) {
    KBConvertDict(item, clazz, converter);
  } else if ([item isKindOfClass:NSDictionary.class]) {
    NSCAssert(NO, @"Not mutable dict");
  } else if ([item isKindOfClass:clazz]) {
    return converter(item);
  }
  return nil;
}


@end
