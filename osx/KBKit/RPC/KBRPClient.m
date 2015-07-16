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
#import "KBRPCRegistration.h"
#import "KBInstaller.h"
#import "KBRPCRecord.h"
#import "KBInstaller.h"
#import "KBWorkspace.h"
#import "KBFormatter.h"

#import <GHKit/GHKit.h>
#import <ObjectiveSugar/ObjectiveSugar.h>
#import <CocoaLumberjack/CocoaLumberjack.h>

@interface KBRPClient ()
@property MPMessagePackClient *client;
@property GHODictionary *registrations;

@property KBRPCRecord *recorder;

@property NSInteger connectAttempt;
@property KBRPClientStatus status;

@property KBEnvironment *environment;
@end

@implementation KBRPClient

- (instancetype)initWithConfig:(KBEnvConfig *)config {
  if ((self = [super init])) {
    _config = config;
  }
  return self;
}

- (void)open:(KBCompletion)completion {
  if (self.status != KBRPClientStatusClosed) {
    completion(KBMakeError(KBErrorCodeAlreadyOpen, @"Already open"));
    return;
  }

  if (self.status == KBRPClientStatusOpening) {
    completion(KBMakeError(KBErrorCodeAlreadyOpening, @"Already opening"));
    return;
  }

  _client.delegate = nil;
  [_client close];

  _status = KBRPClientStatusOpening;

  _client = [[MPMessagePackClient alloc] initWithName:@"KBRPClient" options:MPMessagePackOptionsFramed];
  _client.delegate = self;
  _client.coder = [[KBRPCCoder alloc] init];

//  _recorder = [[KBRPCRecord alloc] init];
  
  GHWeakSelf gself = self;
  _client.requestHandler = ^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBLog(KBLogRPC|KBLogDebug, @"Service requested: %@(%@)", method, KBDescription(params));

//    if ([KBWorkspace userDefaults] boolForKey:@"Preferences.Advanced.Record"]) {
//      [gself.recorder recordRequest:method params:params sessionId:[sessionId integerValue] callback:YES];
//    }

    if ([method isEqualToString:@"keybase.1.logUi.log"]) {
      KBRLogRequestParams *requestParams = [[KBRLogRequestParams alloc] initWithParams:params];
      [gself.delegate RPClient:gself didLog:requestParams.text.data];
      completion(nil, nil);
      return;
    } else if ([method isEqualToString:@"keybase.1.secretUi.getSecret"]) {
      KBLog(KBLogRPC|KBLogDebug, @"Password prompt: %@", KBDescription(params));
      KBRGetSecretRequestParams *requestParams = [[KBRGetSecretRequestParams alloc] initWithParams:params];
      [gself.delegate RPClient:gself didRequestSecretForPrompt:requestParams.pinentry.prompt info:@"" details:requestParams.pinentry.desc previousError:requestParams.pinentry.err completion:^(NSString *secret) {
        KBRSecretEntryRes *entry = [[KBRSecretEntryRes alloc] init];
        entry.text = secret;
        entry.canceled = !secret;
        completion(nil, entry);
      }];
      return;
    } else if ([method isEqualToString:@"keybase.1.secretUi.getKeybasePassphrase"]) {
      KBLog(KBLogRPC|KBLogDebug, @"Password prompt: %@", KBDescription(params));
      KBRGetKeybasePassphraseRequestParams *requestParams = [[KBRGetKeybasePassphraseRequestParams alloc] initWithParams:params];
      [gself.delegate RPClient:gself didRequestKeybasePassphraseForUsername:requestParams.username completion:^(NSString *passphrase) {
        completion(nil, passphrase);
      }];
      return;
    }

    id sessionId = [[params lastObject] objectForKey:@"sessionID"];
    MPRequestHandler requestHandler;
    if (sessionId) {
      KBRPCRegistration *registration = gself.registrations[sessionId];
      requestHandler = [registration requestHandlerForMethod:method];
    }
    if (!requestHandler) {
      KBLog(KBLogRPC|KBLogWarn, @"Received a callback with no sessionID; messageId=%@, method=%@", messageId, method);
      requestHandler = [gself _requestHandlerForMethod:method]; // TODO: Remove when we have session id in all requests
    }
    if (requestHandler) {
      requestHandler(messageId, method, params, completion);
    } else {
      KBLog(KBLogRPC|KBLogDebug, @"No handler for request: %@", method);
      completion(KBMakeError(KBErrorCodeUnsupported, @"Method not found: %@", method), nil);
    }
  };

  [self _open:completion];
}

- (void)_open:(KBCompletion)completion {
  KBLog(KBLogRPC|KBLogDebug, @"Connecting (%@): %@", @(_connectAttempt), [self.config sockFile]);
  _connectAttempt++;
  GHWeakSelf gself = self;
  [self.delegate RPClientWillConnect:self];
  [_client openWithSocket:[self.config sockFile] completion:^(NSError *error) {
    if (error) {
      gself.status = KBRPClientStatusClosed;

      KBLog(KBLogRPC|KBLogDebug, @"Error connecting: %@", error);
      [gself.delegate RPClient:gself didErrorOnConnect:error connectAttempt:gself.connectAttempt];

      if (!gself.autoRetryDisabled) {
        [gself openAfterDelay:2 completion:completion];
      } else {
        completion(error);
      }
      return;
    }

    KBLog(KBLogRPC|KBLogDebug, @"Connected.");
    gself.connectAttempt = 1;
    gself.status = KBRPClientStatusOpen;
    [self.delegate RPClientDidConnect:self];
    completion(nil);
  }];
}

- (void)openAfterDelay:(NSTimeInterval)delay completion:(KBCompletion)completion {
  GHWeakSelf gself = self;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, delay * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
    [gself open:completion];
  });
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

- (void)sendRequestWithMethod:(NSString *)method params:(NSDictionary *)params sessionId:(NSInteger)sessionId completion:(MPRequestCompletion)completion {
  NSTimeInterval delay = 0;
#ifdef DEBUG
  //delay = 0.5;
#endif
  if (delay > 0) {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delay * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      [self _sendRequestWithMethod:method params:params sessionId:sessionId completion:completion];
    });
  } else {
    [self _sendRequestWithMethod:method params:params sessionId:sessionId completion:completion];
  }
}

- (void)_sendRequestWithMethod:(NSString *)method params:(NSDictionary *)params sessionId:(NSInteger)sessionId completion:(MPRequestCompletion)completion {
  if (_client.status != MPMessagePackClientStatusOpen) {
    completion(KBMakeErrorWithRecovery(-400, @"We are unable to connect to the Keybase service.", @"You may need to update or re-install to fix this."), nil);
    return;
  }

  NSAssert(sessionId > 0, @"Bad session id");

  NSMutableDictionary *mparams = [params mutableCopy];
  [mparams gh_mutableCompact];

  KBLog(KBLogRPC|KBLogDebug, @"Requesting: %@(%@)", method, KBDescription(KBScrubSensitive(mparams)));

  [_client sendRequestWithMethod:method params:@[mparams] messageId:sessionId completion:^(NSError *error, id result) {
    [self unregister:sessionId];
    if (error) {
      KBLog(KBLogRPC|KBLogError, @"%@", error);
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
    if ([[KBWorkspace userDefaults] boolForKey:@"Preferences.Advanced.Record"]) {
      if (result) [self.recorder recordResponse:method response:result sessionId:sessionId];
    }
    KBLog(KBLogRPC|KBLogDebug, @"Replied (%@): %@", method, result ? KBDescription(result) : @"{}");
    completion(error, result);
  }];
  
//  if ([[KBWorkspace userDefaults] boolForKey:@"Preferences.Advanced.Record"]) {
//    [self.recorder recordRequest:method params:[_client encodeObject:params] sessionId:sessionId callback:NO];
//  }
}

- (void)check:(void (^)(NSError *error, NSString *version))completion {
  KBRConfigRequest *request = [[KBRConfigRequest alloc] initWithClient:self];
  [request getConfigWithSessionID:request.sessionId completion:^(NSError *error, KBRConfig *config) {
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

NSDictionary *KBScrubSensitive(NSDictionary *dict) {
  NSMutableDictionary *mdict = [dict mutableCopy];
  if (dict[@"passphrase"]) mdict[@"passphrase"] = @"[FILTERED PASSPHRASE]";
  if (dict[@"password"]) mdict[@"password"] = @"[FILTERED PASSWORD]";
  if (dict[@"inviteCode"]) mdict[@"inviteCode"] = @"[FILTERED INVITE CODE]";
  if (dict[@"email"]) mdict[@"email"] = @"[FILTERED EMAIL]";
  return mdict;
}

#pragma mark -

- (void)client:(MPMessagePackClient *)client didError:(NSError *)error fatal:(BOOL)fatal {
  KBLog(KBLogRPC|KBLogError, @"Error (fatal=%d): %@", fatal, error);
}

- (void)client:(MPMessagePackClient *)client didChangeStatus:(MPMessagePackClientStatus)status {
  if (status == MPMessagePackClientStatusClosed) {
    // TODO: What if we have open requests?
    [self _didClose];
    if (!_autoRetryDisabled) [self openAfterDelay:2 completion:nil];
  } else if (status == MPMessagePackClientStatusOpen) {

  }
}

- (void)client:(MPMessagePackClient *)client didReceiveNotificationWithMethod:(NSString *)method params:(id)params {
  KBLog(KBLogRPC|KBLogDebug, @"Notification: %@(%@)", method, KBDescription(params));
}

@end

@implementation KBRPCCoder
- (id)encodeObject:(id)obj {
  return [obj conformsToProtocol:@protocol(MTLJSONSerializing)] ? [MTLJSONAdapter JSONDictionaryFromModel:obj error:nil] : obj; // TODO: Handle model error
}
@end
