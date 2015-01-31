//
//  KBRPClient.m
//  Keybase
//
//  Created by Gabriel on 12/15/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "KBRPClient.h"
#import "KBRPC.h"
#import "KBRUtils.h"

#import <MPMessagePack/MPMessagePackServer.h>
#import <NAChloride/NAChloride.h>

@interface KBRPClient ()
@property MPMessagePackClient *client;
@property MPMessagePackServer *server;
@property NSMutableDictionary *methods;

// For recording/replaying
@property NSString *recordId;
@property NSInteger methodIndex;
@end

@interface KBMantleCoder : NSObject <MPMessagePackCoder>
@end

@implementation KBMantleCoder
- (NSDictionary *)encodeObject:(id)obj {
  return [obj conformsToProtocol:@protocol(MTLJSONSerializing)] ? [MTLJSONAdapter JSONDictionaryFromModel:obj] : obj;
}
@end

@implementation KBRPClient

- (void)open {
  _client = [[MPMessagePackClient alloc] initWithName:@"KBRPClient" options:MPMessagePackOptionsFramed];
  _client.delegate = self;
  _methods = [NSMutableDictionary dictionary];

  _recordId = [[NSDate date] gh_formatISO8601];
  
  GHWeakSelf blockSelf = self;
  _client.requestHandler = ^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    GHDebug(@"Received request: %@(%@)", method, [params join:@", "]);
    // Recording
    //[blockSelf recordMethod:method params:params];

    MPRequestHandler requestHandler = blockSelf.methods[method];
    if (!requestHandler) {
      GHDebug(@"No handler for request");
      completion(KBMakeError(-1, @"Method not found", @"Method not found: %@", method), nil);
      return;
    }
    requestHandler(method, params, completion);
  };

  _client.coder = [[KBMantleCoder alloc] init];
  
  NSString *user = [NSProcessInfo.processInfo.environment objectForKey:@"USER"];
  NSAssert(user, @"No user");
  
  GHDebug(@"Connecting to keybased (%@)...", user);
  [_client openWithSocket:NSStringWithFormat(@"/tmp/keybase-%@/keybased.sock", user) completion:^(NSError *error) {
    if (error) {
      GHDebug(@"Error connecting to keybased: %@", error);
      // Retry
      [self openAfterDelay:2];
      return;
    }
    
    [self.delegate RPClientDidConnect:self];
  }];
}

- (void)registerMethod:(NSString *)method requestHandler:(MPRequestHandler)requestHandler {
  _methods[method] = requestHandler;
}

- (void)openAfterDelay:(NSTimeInterval)delay {
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 2 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
    [self open];
  });
}

- (void)sendRequestWithMethod:(NSString *)method params:(NSArray *)params completion:(MPRequestCompletion)completion {
  if (_client.status != MPMessagePackClientStatusOpen) {
    completion(KBMakeError(-400, @"We are unable to connect to the keybase daemon.", @""), nil);
    return;
  }
        
  [_client sendRequestWithMethod:method params:params completion:^(NSError *error, id result) {
    if (error) GHDebug(@"Error: %@", error);
    completion(error, result);
  }];
  GHDebug(@"Sent request: %@(%@)", method, params);
  //GHDebug(@"Sent request: %@", [request gh_toJSON:NSJSONWritingPrettyPrinted error:nil]);
}

#pragma mark -

- (void)client:(MPMessagePackClient *)client didError:(NSError *)error fatal:(BOOL)fatal {
  GHDebug(@"Error (fatal=%d): %@", fatal, error);
}

- (void)client:(MPMessagePackClient *)client didChangeStatus:(MPMessagePackClientStatus)status {
  if (status == MPMessagePackClientStatusClosed) {
    [self openAfterDelay:2];
  } else if (status == MPMessagePackClientStatusOpen) {
    
  }
}

- (void)client:(MPMessagePackClient *)client didReceiveNotificationWithMethod:(NSString *)method params:(id)params {
  GHDebug(@"Notification: %@(%@)", method, [params join:@","]);
}

#pragma mark Mock

- (void)recordMethod:(NSString *)method params:(NSArray *)params {
  NSMutableArray *paramsCopy = [[NSKeyedUnarchiver unarchiveObjectWithData: [NSKeyedArchiver archivedDataWithRootObject:params]] mutableCopy];

  NSString *directory = NSStringWithFormat(@"/Users/gabe/Projects/keybase/osx-client/Tests/Mocks/%@", _recordId);
  [NSFileManager.defaultManager createDirectoryAtPath:directory withIntermediateDirectories:YES attributes:nil error:nil];
  NSInteger index = _methodIndex++;
  NSString *file = NSStringWithFormat(@"%@/%@--%@.json", directory, @(index), method);
  KBConvertArrayTo(paramsCopy);
  [[NSJSONSerialization dataWithJSONObject:paramsCopy options:NSJSONWritingPrettyPrinted error:nil] writeToFile:file atomically:NO];
}

- (void)replayRecordId:(NSString *)recordId range:(NSRange)range {
  NSString *directory = NSStringWithFormat(@"/Users/gabe/Projects/keybase/osx-client/Tests/Mocks/%@", recordId);
  NSArray *files = [NSFileManager.defaultManager contentsOfDirectoryAtPath:directory error:nil];
  NSMutableDictionary *fileDict = [NSMutableDictionary dictionary];
  for (NSString *file in files) {
    NSArray *split = [file split:@"--"];
    NSInteger index = [split[0] integerValue];
    NSString *method = [split[1] substringToIndex:[split[1] length] - 5];
    fileDict[@(index)] = @{@"file": file, @"method": method};
  }

  for (NSInteger index = range.location; index < range.length; index++) {
    NSString *file = fileDict[@(index)][@"file"];
    NSString *method = fileDict[@(index)][@"method"];
    id params = [NSJSONSerialization JSONObjectWithData:[NSData dataWithContentsOfFile:NSStringWithFormat(@"%@/%@", directory, file)] options:NSJSONReadingMutableContainers error:nil];
    KBConvertArrayFrom(params);
    MPRequestHandler completion = _methods[method];
    if (completion) completion(method, params, ^(NSError *error, id result) { });
  }
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
