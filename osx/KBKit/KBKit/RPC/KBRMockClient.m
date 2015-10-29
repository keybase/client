//
//  KBRMockClient.m
//  Keybase
//
//  Created by Gabriel on 2/25/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBRMockClient.h"

#import "KBRPCRegistration.h"
#import "KBRPCRecord.h"
#import "KBWorkspace.h"
#import "KBDefines.h"
#import "KBConvert.h"

#import <GHKit/GHKit.h>
#import <ObjectiveSugar/ObjectiveSugar.h>
#import <CocoaLumberjack/CocoaLumberjack.h>

@interface KBRMockClient ()
@property NSMutableDictionary *registrations;
@end

@implementation KBRMockClient

- (NSNumber *)nextSessionId {
  static NSInteger gSessionId = 0;
  return [NSNumber numberWithInteger:++gSessionId];
}

- (void)open {
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(2 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    [self.delegate RPClientDidConnect:self];
  });
}

- (void)sendRequestWithMethod:(NSString *)method params:(NSArray *)params sessionId:(NSNumber *)sessionId completion:(MPRequestCompletion)completion {
  self.completion = completion;
  if (self.handler) {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(2 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      self.handler(sessionId, method, params, completion);
    });
    return;
  }

  NSDictionary *response = [KBRMockClient responseForMethod:method];
  if (response) {
    completion(nil, response);
  } else {
    if (![self replayMethod:method completion:completion]) {
      completion(KBMakeError(KBErrorCodeUnsupported, @"No mock for method: %@", method), nil);
    }
  }
}

- (void)registerMethod:(NSString *)method sessionId:(NSNumber *)sessionId requestHandler:(MPRequestHandler)requestHandler {
  if (!self.registrations) self.registrations = [NSMutableDictionary dictionary];
  KBRPCRegistration *registration = self.registrations[sessionId];
  if (!registration) {
    registration = [[KBRPCRegistration alloc] init];
    self.registrations[sessionId] = registration;
  }
  [registration registerMethod:method requestHandler:requestHandler];
}

- (void)unregister:(NSNumber *)sessionId {
  [self.registrations removeObjectForKey:sessionId];
}

- (BOOL)replayMethod:(NSString *)requestMethod completion:(MPRequestCompletion)completion {
  GHWeakSelf gself = self;
  NSString *directory = [KBWorkspace applicationSupport:@[@"Record", @"default", requestMethod] create:NO error:nil];
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
  NSString *path = [KBWorkspace applicationSupport:paths create:NO error:nil];
  NSData *data = [NSData dataWithContentsOfFile:path];
  //NSAssert(data, @"No data found at %@", path);
  if (!data) return nil;
  return [NSJSONSerialization JSONObjectWithData:data options:NSJSONReadingMutableContainers error:nil];
}

@end
