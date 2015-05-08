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

@end

@implementation KBRMockClient

- (NSInteger)nextSessionId {
  static NSInteger gSessionId = 0;
  return ++gSessionId;
}

- (void)open {
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(2 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    [self.delegate RPClientDidConnect:self];
  });
}

- (void)checkInstall:(KBInstallCheck)completion {
  completion(@[]);
}

- (void)sendRequestWithMethod:(NSString *)method params:(NSArray *)params sessionId:(NSInteger)sessionId completion:(MPRequestCompletion)completion {
  self.completion = completion;
  if (self.handler) {
    self.handler(@(sessionId), method, params, completion);
    return;
  }

  NSDictionary *response = [KBRMockClient responseForMethod:method];
  if (response) {
    completion(nil, response);
  } else {
    if (![self replayMethod:method completion:completion]) {
      completion(KBMakeError(-1, @"No mock for method: %@", method), nil);
    }
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

- (BOOL)replayMethod:(NSString *)requestMethod completion:(MPRequestCompletion)completion {
  GHWeakSelf gself = self;
  NSString *directory = [AppDelegate applicationSupport:@[@"Record", @"default", requestMethod] create:NO error:nil];
  NSArray *files = [NSFileManager.defaultManager contentsOfDirectoryAtPath:directory error:nil];

  if (files.count == 0) {
    return NO;
  }

  NSMutableDictionary *fileDict = [NSMutableDictionary dictionary];
  NSInteger start = NSIntegerMax;
  NSInteger end = 0;
  for (NSString *file in files) {
    NSArray *split = [[file substringToIndex:file.length-5] split:@"--"];
    if (split.count != 3) continue;
    NSInteger index = [split[0] integerValue];

    if (index < start) start = index;
    if (index > end) end = index;

    fileDict[@(index)] = @{@"file": file, @"method": split[1], @"label": split[2]};
  }

  for (NSInteger index = start; index <= end; index++) {
    NSString *file = fileDict[@(index)][@"file"];
    NSString *method = fileDict[@(index)][@"method"];
    NSString *label = fileDict[@(index)][@"label"];
    NSArray *request = nil;
    if ([label isEqualTo:@"request"] && ![method isEqualTo:requestMethod]) { // Ignore self request
      request = [self.class parseRequest:@[@"Record", @"default", requestMethod, file]];
    } else if ([label isEqualTo:@"response"]) {
      id response = [self.class parseResponse:@[@"Record", @"default", requestMethod, file]];
      completion(nil, response);
      break;
    }
    if (!request) continue;
    DDLogDebug(@"Replay %@", method);
    for (id key in gself.registrations) {
      KBRPCRegistration *registration = gself.registrations[key];
      MPRequestHandler completion = [registration requestHandlerForMethod:method];
      if (completion) completion(nil, method, request, ^(NSError *error, id result) { });
    }
  }
  return YES;
}

+ (id)responseForMethod:(NSString *)method {
  NSArray *paths = @[@"Record", @"default", NSStringWithFormat(@"%@-response.json", method)];
  return [self parseResponse:paths];
}

+ (NSArray *)requestForMethod:(NSString *)method {
  NSArray *paths = @[@"Record", @"default", NSStringWithFormat(@"%@-request.json", method)];
  return [self parseRequest:paths];
}

+ (NSArray *)parseRequest:(NSArray *)paths {
  NSMutableArray *request = [[self parse:paths] mutableCopy];
  KBConvertArrayFrom(request);
  return request;
}

+ (id)parseResponse:(NSArray *)paths {
  NSMutableDictionary *response = [[self parse:paths] mutableCopy];
  KBConvertDictFrom(response);
  return response;
}

+ (id)parse:(NSArray *)paths {
  NSString *path = [AppDelegate applicationSupport:paths create:NO error:nil];
  NSData *data = [NSData dataWithContentsOfFile:path];
  //NSAssert(data, @"No data found at %@", path);
  if (!data) return nil;
  return [NSJSONSerialization JSONObjectWithData:data options:NSJSONReadingMutableContainers error:nil];
}

@end
