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
#import "KBRPCRecord.h"

@interface KBRMockClient ()
@property NSMutableDictionary *registrations;
@property NSString *socketPath;
@end

@implementation KBRMockClient

- (NSInteger)nextSessionId {
  static NSInteger gSessionId = 0;
  return ++gSessionId;
}

- (void)open {
  self.socketPath = @"RPCMock";
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(2 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    [self.delegate RPClientDidConnect:self];
  });
}

- (void)checkInstall:(KBCompletionBlock)completion {
  completion(nil);
}

- (void)sendRequestWithMethod:(NSString *)method params:(NSArray *)params sessionId:(NSInteger)sessionId completion:(MPRequestCompletion)completion {
  self.completion = completion;
  if (self.handler) self.handler(@(sessionId), method, params, completion);

  NSDictionary *response = [KBRMockClient responseForMethod:method];
  if (response) {
    completion(nil, response);
  } else {
    completion(KBMakeError(-1, @"No mock for method: %@", method), nil);
  }
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

/*
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
 */

+ (id)responseForMethod:(NSString *)method {
  NSMutableDictionary *response = [[self parse:@"default" file:NSStringWithFormat(@"%@-response.json", method)] mutableCopy];
  KBConvertDictFrom(response);
  return response;
}

+ (NSArray *)requestForMethod:(NSString *)method {
  NSMutableArray *request = [[self parse:@"default" file:NSStringWithFormat(@"%@-request.json", method)] mutableCopy];
  KBConvertArrayFrom(request);
  return request;
}

+ (id)parse:(NSString *)dir file:(NSString *)file {
  NSArray *paths = @[@"Record", dir, file];
  NSString *path = [AppDelegate applicationSupport:paths create:NO error:nil];
  NSData *data = [NSData dataWithContentsOfFile:path];
  //NSAssert(data, @"No data found at %@", path);
  if (!data) return nil;
  return [NSJSONSerialization JSONObjectWithData:data options:NSJSONReadingMutableContainers error:nil];
}

@end
