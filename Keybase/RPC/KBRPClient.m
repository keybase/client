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
#import "KBAlert.h"
#import "AppDelegate.h"

#import <MPMessagePack/MPMessagePackServer.h>
#import <NAChloride/NAChloride.h>

@interface KBRPClient ()
@property MPMessagePackClient *client;
@property MPMessagePackServer *server;
@property NSMapTable *registrations;

@property NSInteger connectAttempt;

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
  [self open:nil];
}

- (void)open:(void (^)(NSError *error))completion {
  _client = [[MPMessagePackClient alloc] initWithName:@"KBRPClient" options:MPMessagePackOptionsFramed];
  _client.delegate = self;

  _recordId = [[NSDate date] gh_formatISO8601];
  
  GHWeakSelf gself = self;
  _client.requestHandler = ^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    GHDebug(@"Received request: %@(%@)", method, [params join:@", "]);
    // Recording
    if ([NSUserDefaults.standardUserDefaults boolForKey:@"Preferences.Advanced.Record"]) {
      [gself recordMethod:method params:params];
    }

    NSMapTable *registration = [gself.registrations objectForKey:method];
    MPRequestHandler requestHandler = [registration objectForKey:@"requestHandler"];
    if (!requestHandler) {
      GHDebug(@"No handler for request: %@", method);
      completion(KBMakeError(-1, @"Method not found", @"Method not found: %@", method), nil);
      return;
    }
    requestHandler(method, params, completion);
  };

  _client.coder = [[KBMantleCoder alloc] init];
  
  NSString *user = [NSProcessInfo.processInfo.environment objectForKey:@"USER"];
  NSAssert(user, @"No user");
  
  GHDebug(@"Connecting to keybased (%@)...", user);
  _connectAttempt++;
  [_client openWithSocket:NSStringWithFormat(@"/tmp/keybase-%@/keybased.sock", user) completion:^(NSError *error) {
    if (error) {
      GHDebug(@"Error connecting to keybased: %@", error);
      if (!gself.autoRetryDisabled) {
        // Retry
        [self openAfterDelay:2];
      } else {
        if (completion) completion(error);
      }
      [self.delegate RPClient:self didErrorOnConnect:error connectAttempt:gself.connectAttempt];
      return;
    }

    GHDebug(@"Connected");
    gself.connectAttempt = 1;
    [self.delegate RPClientDidConnect:self];
    if (completion) completion(nil);
  }];
}

- (void)close {
  [_client close];
  [self.delegate RPClientDidDisconnect:self];
}

- (void)registerMethod:(NSString *)method owner:(id)owner requestHandler:(MPRequestHandler)requestHandler {
  if (!_registrations) _registrations = [NSMapTable strongToStrongObjectsMapTable];

  //GHDebug(@"Registering %@", method);
  //NSAssert(![_registrations objectForKey:method], @"Method already registered");

  NSMapTable *registration = [NSMapTable strongToStrongObjectsMapTable];
  [registration setObject:requestHandler forKey:@"requestHandler"];
  [registration setObject:owner forKey:@"owner"];

  [_registrations setObject:registration forKey:method];
}

- (void)unregister:(id)owner {
  NSArray *keys = [[_registrations dictionaryRepresentation] allKeys];
  for (NSString *method in keys) {
    NSMapTable *registration = [_registrations objectForKey:method];
    if ([[registration objectForKey:@"owner"] isEqualTo:owner]) {
      //GHDebug(@"Unregistering %@", method);
      [_registrations removeObjectForKey:method];
    }
  }
}

- (void)openAfterDelay:(NSTimeInterval)delay {
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 2 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
    [self open:nil];
  });
}

- (void)sendRequestWithMethod:(NSString *)method params:(NSArray *)params completion:(MPRequestCompletion)completion {
  if (_client.status != MPMessagePackClientStatusOpen) {
    completion(KBMakeError(-400, @"We are unable to connect to the keybase daemon.", @""), nil);
    return;
  }
        
  [_client sendRequestWithMethod:method params:params completion:^(NSError *error, id result) {
    if (error) {
      GHDebug(@"Error: %@", error);
      NSDictionary *errorInfo = error.userInfo[MPErrorInfoKey];
      error = KBMakeError(error.code, errorInfo[@"desc"], @"");
    }
    GHDebug(@"Result: %@", result);
    completion(error, result);
  }];

  NSMutableArray *mparams = [params mutableCopy];
  mparams[0] = KBScrubPassphrase(params[0]);

  GHDebug(@"Sent request: %@(%@)", method, [mparams join:@", "]);
}

- (void)check:(void (^)(NSError *error))completion {
  KBRConfigRequest *config = [[KBRConfigRequest alloc] initWithClient:self];
  [config getCurrentStatus:^(NSError *error, KBRGetCurrentStatusRes *status) {
    completion(error);
  }];
}

- (void)openAndCheck:(void (^)(NSError *error))completion {
  [self open:^(NSError *error) {
    if (error) {
      completion(error);
      return;
    }
    [self check:^(NSError *error) {
      if (error) {
        completion(error);
        return;
      }
    }];
    completion(nil);
  }];
}

NSDictionary *KBScrubPassphrase(NSDictionary *dict) {
  NSMutableDictionary *mdict = [dict mutableCopy];
  if (mdict[@"passphrase"]) mdict[@"passphrase"] = @"[FILTERED PASSPHRASE]";
  if (mdict[@"password"]) mdict[@"password"] = @"[FILTERED PASSWORD]";
  if (mdict[@"inviteCode"]) mdict[@"inviteCode"] = @"[FILTERED INVITE CODE]";
  if (mdict[@"email"]) mdict[@"email"] = @"[FILTERED EMAIL]";
  return mdict;
}

#pragma mark -

- (void)client:(MPMessagePackClient *)client didError:(NSError *)error fatal:(BOOL)fatal {
  GHDebug(@"Error (fatal=%d): %@", fatal, error);
}

- (void)client:(MPMessagePackClient *)client didChangeStatus:(MPMessagePackClientStatus)status {
  if (status == MPMessagePackClientStatusClosed) {
    // TODO: What if we have open requests?
    if (!_autoRetryDisabled) [self openAfterDelay:2];
  } else if (status == MPMessagePackClientStatusOpen) {
    
  }
}

- (void)client:(MPMessagePackClient *)client didReceiveNotificationWithMethod:(NSString *)method params:(id)params {
  GHDebug(@"Notification: %@(%@)", method, [params join:@","]);
}

#pragma mark Mock


- (void)recordMethod:(NSString *)method params:(NSArray *)params {
  NSInteger index = _methodIndex++;
  [AppDelegate applicationSupport:@[_recordId] create:YES completion:^(NSError *error, NSString *directory) {
    NSNumberFormatter *indexFormatter = [[NSNumberFormatter alloc] init];
    [indexFormatter setFormatWidth:4];
    [indexFormatter setPaddingCharacter:@"0"];

    NSString *file = NSStringWithFormat(@"%@/%@--%@.json", directory, [indexFormatter stringFromNumber:@(index)], method);
    NSMutableArray *paramsCopy = [[NSKeyedUnarchiver unarchiveObjectWithData: [NSKeyedArchiver archivedDataWithRootObject:params]] mutableCopy];
    KBConvertArrayTo(paramsCopy);
    [[NSJSONSerialization dataWithJSONObject:paramsCopy options:NSJSONWritingPrettyPrinted error:nil] writeToFile:file atomically:NO];
  }];
}


- (void)paramsFromRecordId:(NSString *)recordId file:(NSString *)file completion:(void (^)(NSArray *params))completion {
  [AppDelegate applicationSupport:@[recordId] create:YES completion:^(NSError *error, NSString *directory) {
    NSData *data = [NSData dataWithContentsOfFile:NSStringWithFormat(@"%@/%@", directory, file)];
    NSAssert(data, @"No data found");
    id params = [NSJSONSerialization JSONObjectWithData:data options:NSJSONReadingMutableContainers error:nil];
    KBConvertArrayFrom(params);
    completion(params);
  }];
}

- (void)replayRecordId:(NSString *)recordId {
  GHWeakSelf gself = self;
  [AppDelegate applicationSupport:@[recordId] create:YES completion:^(NSError *error, NSString *directory) {
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
      NSMapTable *registration = [gself.registrations objectForKey:method];
      MPRequestHandler completion = [registration objectForKey:@"requestHandler"];
      if (completion) completion(method, params, ^(NSError *error, id result) { });
    }
  }];
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
