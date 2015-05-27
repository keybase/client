//
//  KBRPClient.m
//  Keybase
//
//  Created by Gabriel on 12/15/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "KBRPClient.h"
#import "KBRPC.h"
#import "KBAlert.h"
#import "AppDelegate.h"
#import "KBRPCRegistration.h"
#import "KBInstaller.h"
#import "KBRPCRecord.h"
#import "KBInstaller.h"

#import <MPMessagePack/MPMessagePackServer.h>

@interface KBRPClient ()
@property MPMessagePackClient *client;
@property MPMessagePackServer *server;
@property GHODictionary *registrations;

@property KBRPCRecord *recorder;

@property NSInteger connectAttempt;
@property KBRPClientStatus status;

@property KBEnvironment *environment;
@end

@implementation KBRPClient

- (instancetype)initWithEnvironment:(KBEnvironment *)environment {
  if ((self = [super init])) {
    _environment = environment;
  }
  return self;
}

- (void)open {
  [self open:nil];
}

- (void)open:(void (^)(NSError *error))completion {
  //NSAssert(self.status == KBRPClientStatusClosed, @"Not closed");
  if (self.status != KBRPClientStatusClosed) {
    // Already open
    if (completion) completion(nil);
    return;
  }

  _status = KBRPClientStatusOpening;

  _client = [[MPMessagePackClient alloc] initWithName:@"KBRPClient" options:MPMessagePackOptionsFramed];
  _client.delegate = self;

  _recorder = [[KBRPCRecord alloc] init];
  
  GHWeakSelf gself = self;
  _client.requestHandler = ^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    //DDLogDebug(@"Received request: %@(%@)", method, [params join:@", "]);

    id sessionId = [[params lastObject] objectForKey:@"sessionID"];

    if ([NSUserDefaults.standardUserDefaults boolForKey:@"Preferences.Advanced.Record"]) {
      [gself.recorder recordRequest:method params:params sessionId:[sessionId integerValue] callback:YES];
    }
    MPRequestHandler requestHandler;
    if (sessionId) {
      KBRPCRegistration *registration = gself.registrations[sessionId];
      requestHandler = [registration requestHandlerForMethod:method];
    }
    if (!requestHandler) {
      DDLogWarn(@"Received a callback with no sessionID; messageId=%@, method=%@", messageId, method);
      requestHandler = [gself _requestHandlerForMethod:method]; // TODO: Remove when we have session id in all requests
    }
    if (requestHandler) {
      requestHandler(messageId, method, params, completion);
    } else {
      DDLogDebug(@"No handler for request: %@", method);
      completion(KBMakeError(-1, @"Method not found: %@", method), nil);
    }
  };

  _client.coder = [[KBRPCCoder alloc] init];

  DDLogDebug(@"Connecting: %@", [self.environment sockFile:YES]);
  _connectAttempt++;
  [self.delegate RPClientWillConnect:self];
  [_client openWithSocket:[self.environment sockFile:YES] completion:^(NSError *error) {
    if (error) {
      gself.status = KBRPClientStatusClosed;

      DDLogDebug(@"Error connecting: %@", error);
      if (!gself.autoRetryDisabled) {
        // Retry
        [self openAfterDelay:2];
      } else {
        if (completion) completion(error);
      }
      [self.delegate RPClient:self didErrorOnConnect:error connectAttempt:gself.connectAttempt];
      return;
    }

    DDLogDebug(@"Connected.");
    gself.connectAttempt = 1;
    gself.status = KBRPClientStatusOpen;
    [self.delegate RPClientDidConnect:self];
    if (completion) completion(nil);
  }];
}

// Request handler for method of any session (Will be deprecated)
- (MPRequestHandler)_requestHandlerForMethod:(NSString *)method {
  NSMutableArray *requestHandlers = [NSMutableArray array];
  for (id key in [self.registrations reverseKeyEnumerator]) {
    KBRPCRegistration *registration = self.registrations[key];
    MPRequestHandler requestHandler = [registration requestHandlerForMethod:method];
    if (requestHandler) [requestHandlers addObject:requestHandler];
  }
  NSAssert([requestHandlers count] < 2, @"More than 1 registered request handler");
  return [requestHandlers firstObject];
}

- (NSInteger)nextSessionId {
  static NSInteger gSessionId = 0;
  return ++gSessionId;
}

- (void)close {
  [_client close];
  [self _didClose];
}

- (void)_didClose {
  self.status = KBRPClientStatusClosed;
  [self.delegate RPClientDidDisconnect:self];
}

- (void)openAfterDelay:(NSTimeInterval)delay {
  GHWeakSelf gself = self;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 2 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
    if (gself.status != KBRPClientStatusOpening) {
      [self open:nil];
    }
  });
}

- (void)sendRequestWithMethod:(NSString *)method params:(NSArray *)params sessionId:(NSInteger)sessionId completion:(MPRequestCompletion)completion {
  NSTimeInterval delay = 0;
#ifdef DEBUG
  delay = 0.5;
#endif
  if (delay > 0) {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delay * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      [self _sendRequestWithMethod:method params:params sessionId:sessionId completion:completion];
    });
  } else {
    [self _sendRequestWithMethod:method params:params sessionId:sessionId completion:completion];
  }
}

- (void)_sendRequestWithMethod:(NSString *)method params:(NSArray *)params sessionId:(NSInteger)sessionId completion:(MPRequestCompletion)completion {
  if (_client.status != MPMessagePackClientStatusOpen) {
    completion(KBMakeErrorWithRecovery(-400, @"We are unable to connect to the Keybase service.", @"You may need to update or re-install to fix this."), nil);
    return;
  }

  NSAssert(sessionId > 0, @"Bad session id");

  [_client sendRequestWithMethod:method params:params messageId:sessionId completion:^(NSError *error, id result) {
    [self unregister:sessionId];
    if (error) {
      DDLogError(@"%@", error);
      NSDictionary *errorInfo = error.userInfo[MPErrorInfoKey];

      NSString *name = errorInfo[@"name"];
      if ([name isEqualTo:@"GENERIC"]) name = nil;
      NSString *desc = name ? NSStringWithFormat(@"%@ (%@)", errorInfo[@"desc"], name) : errorInfo[@"desc"];
      error = [NSError errorWithDomain:@"Keybase" code:error.code userInfo:
               @{NSLocalizedDescriptionKey: NSStringWithFormat(@"Oops, we had a problem (%@).", @(error.code)),
                 NSLocalizedRecoveryOptionsErrorKey: @[@"OK"],
                 NSLocalizedRecoverySuggestionErrorKey: desc,
                 MPErrorInfoKey: errorInfo,
                 }];
    }
    if ([NSUserDefaults.standardUserDefaults boolForKey:@"Preferences.Advanced.Record"]) {
      if (result) [self.recorder recordResponse:method response:result sessionId:sessionId];
    }
    DDLogDebug(@"Reply (%@): %@", method, KBDescription(result));
    completion(error, result);
  }];

  NSMutableArray *mparams = [params mutableCopy];
  mparams[0] = KBScrubPassphrase(params[0]);

  //NSNumber *messageId = request[1];
  DDLogDebug(@"Request: %@(%@)", method, [mparams[0] count] > 0 ? KBDescription(mparams[0]) : @"");
  if ([NSUserDefaults.standardUserDefaults boolForKey:@"Preferences.Advanced.Record"]) {
    [self.recorder recordRequest:method params:[_client encodeObject:params] sessionId:sessionId callback:NO];
  }
}

- (void)check:(void (^)(NSError *error, NSString *version))completion {
  KBRConfigRequest *config = [[KBRConfigRequest alloc] initWithClient:self];
  [config getConfig:^(NSError *error, KBRConfig *config) {
    completion(error, config.version);
  }];
}

- (void)registerMethod:(NSString *)method sessionId:(NSInteger)sessionId requestHandler:(MPRequestHandler)requestHandler {
  if (!self.registrations) self.registrations = [GHODictionary dictionary];
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

- (void)openAndCheck:(void (^)(NSError *error, NSString *version))completion {
  [self open:^(NSError *error) {
    if (error) {
      completion(error, nil);
      return;
    }
    [self check:completion];
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
  DDLogDebug(@"Error (fatal=%d): %@", fatal, error);
}

- (void)client:(MPMessagePackClient *)client didChangeStatus:(MPMessagePackClientStatus)status {
  if (status == MPMessagePackClientStatusClosed) {
    // TODO: What if we have open requests?
    [self _didClose];
    if (!_autoRetryDisabled) [self openAfterDelay:2];
  } else if (status == MPMessagePackClientStatusOpen) {

  }
}

- (void)client:(MPMessagePackClient *)client didReceiveNotificationWithMethod:(NSString *)method params:(id)params {
  DDLogDebug(@"Notification: %@(%@)", method, [params join:@","]);
}

@end

@implementation KBRPCCoder
- (id)encodeObject:(id)obj {
  return [obj conformsToProtocol:@protocol(MTLJSONSerializing)] ? [MTLJSONAdapter JSONDictionaryFromModel:obj error:nil] : obj; // TODO: Handle model error
}
@end