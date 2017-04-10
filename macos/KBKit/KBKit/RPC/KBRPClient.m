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
#import "KBRPCRecord.h"
#import "KBWorkspace.h"
#import "KBFormatter.h"
#import "KBEnvironment.h"
#import "KBLog.h"

#import <GHKit/GHKit.h>
#import <ObjectiveSugar/ObjectiveSugar.h>
#import <CocoaLumberjack/CocoaLumberjack.h>

@interface KBRPClient ()
@property KBRClientOptions options;
@property MPMessagePackClient *client;
@property GHODictionary *registrations;

@property KBRPCRecord *recorder;

@property NSInteger connectAttempt;
@property KBRPClientStatus status;

@property KBEnvironment *environment;
@end

@implementation KBRPClient

- (instancetype)initWithConfig:(KBEnvConfig *)config options:(KBRClientOptions)options {
  if ((self = [super init])) {
    _config = config;
    _options = options;
  }
  return self;
}

+ (MPMessagePackClient *)msgpackClient {
  MPMessagePackClient *client = [[MPMessagePackClient alloc] initWithName:@"KBRPClient" options:MPMessagePackOptionsFramed];
  client.coder = [[KBRPCCoder alloc] init];
  return client;
}

- (void)open:(KBCompletion)completion {
  NSAssert(_config.sockFile, @"No sockFile");
  [self open:_config.sockFile completion:completion];
}

- (void)open:(NSString *)socketFile completion:(KBCompletion)completion {
  NSParameterAssert(completion);
  if (self.status != KBRPClientStatusClosed) {
    completion(KBMakeError(KBErrorCodeAlreadyOpen, @"Already open"));
    return;
  }

  if (self.status == KBRPClientStatusOpening) {
    completion(KBMakeError(KBErrorCodeAlreadyOpening, @"Already opening"));
    return;
  }

  // Ensure its closed
  _client.delegate = nil;
  [_client close];

  _status = KBRPClientStatusOpening;

  _client = [KBRPClient msgpackClient];
  _client.delegate = self;

//  _recorder = [[KBRPCRecord alloc] init];
  
  GHWeakSelf gself = self;
  _client.requestHandler = ^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBLog(KBLogRPC|KBLogDebug, @"Service requested: %@(%@)", method, KBDescription(params));

//    if ([KBWorkspace userDefaults] boolForKey:@"Preferences.Advanced.Record"]) {
//      [gself.recorder recordRequest:method params:params messageId:[messageId integerValue] callback:YES];
//    }

    if ([method isEqualToString:@"keybase.1.logUi.log"]) {
      KBRLogRequestParams *requestParams = [[KBRLogRequestParams alloc] initWithParams:params];
      [gself.delegate RPClient:gself didLog:requestParams.text.data];
      completion(nil, nil);
      return;
    } else if ([method isEqualToString:@"keybase.1.secretUi.getPassphrase"]) {
      KBLog(KBLogRPC|KBLogDebug, @"Password prompt: %@", KBDescription(params));
      KBRGetPassphraseRequestParams *requestParams = [[KBRGetPassphraseRequestParams alloc] initWithParams:params];
      [gself.delegate RPClient:gself didRequestSecretForPrompt:requestParams.pinentry.prompt info:@"" details:@"" previousError:nil completion:^(NSString *secret) {
        KBRSecretEntryRes *entry = [[KBRSecretEntryRes alloc] init];
        entry.text = secret;
        entry.canceled = !secret;
        completion(nil, entry);
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

  [self _open:socketFile completion:completion];
}

- (void)_open:(NSString *)socketFile completion:(KBCompletion)completion {
  NSParameterAssert(completion);

  _connectAttempt++;
  KBLog(KBLogRPC|KBLogDebug, @"Connecting (%@): %@", @(_connectAttempt), [self.config sockFile]);
  GHWeakSelf gself = self;
  [self.delegate RPClientWillConnect:self];
  [_client openWithSocket:socketFile completion:^(NSError *error) {
    if (error) {
      gself.status = KBRPClientStatusClosed;

      KBLog(KBLogRPC|KBLogDebug, @"Error connecting: %@", error);

      BOOL retry = NO;
      if (gself.delegate) {
        retry = [gself.delegate RPClient:gself didErrorOnConnect:error connectAttempt:gself.connectAttempt];
      } else {
        retry = (gself.options & KBRClientOptionsAutoRetry);
      }

      if (retry) {
        [gself openAfterDelay:2 completion:completion];
      } else {
        gself.connectAttempt = 0;
        completion(error);
      }
      return;
    }

    KBLog(KBLogRPC|KBLogDebug, @"Connected.");
    gself.status = KBRPClientStatusOpen;
    gself.connectAttempt = 0;
    [self.delegate RPClientDidConnect:self];
    completion(nil);
  }];
}

- (void)openAfterDelay:(NSTimeInterval)delay completion:(KBCompletion)completion {
  NSParameterAssert(completion);
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

- (NSNumber *)nextMessageId {
  static NSInteger gSessionId = 0;
  return [NSNumber numberWithInteger:++gSessionId];
}

- (void)close {
  KBLog(KBLogRPC|KBLogDebug, @"Closing");
  _client.delegate = nil;
  [_client close];
  [self _didClose];
}

- (void)_didClose {
  self.status = KBRPClientStatusClosed;
  [self.delegate RPClientDidDisconnect:self];
}

- (void)sendRequestWithMethod:(NSString *)method params:(NSDictionary *)params sessionId:(NSNumber *)sessionId completion:(MPRequestCompletion)completion {
  [self sendRequestWithMethod:method params:params messageId:sessionId completion:completion];
}

- (void)sendRequestWithMethod:(NSString *)method params:(NSDictionary *)params messageId:(NSNumber *)messageId completion:(MPRequestCompletion)completion {
  NSTimeInterval delay = 0;
#ifdef DEBUG
  //delay = 0.5;
#endif
  if (delay > 0) {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delay * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      [self _sendRequestWithMethod:method params:params messageId:messageId completion:completion];
    });
  } else {
    [self _sendRequestWithMethod:method params:params messageId:messageId completion:completion];
  }
}

- (void)_respondWithResult:(id)result error:(NSError *)error method:(NSString *)method completion:(MPRequestCompletion)completion {
  if (error) {
    KBLog(KBLogRPC|KBLogError, @"%@", error);
  } else {
    KBLog(KBLogRPC|KBLogDebug, @"Replied (%@): %@", method, result ? KBDescription(result) : @"nil");
  }
  completion(error, result);
}

- (void)_sendRequestWithMethod:(NSString *)method params:(NSDictionary *)params messageId:(NSNumber *)messageId completion:(MPRequestCompletion)completion {
  if (_client.status != MPMessagePackClientStatusOpen) {
    [self _respondWithResult:nil error:KBMakeErrorWithRecovery(-400, @"We are unable to connect to the Keybase service.", @"You may need to update or re-install to fix this.") method:method completion:completion];
    return;
  }

  NSAssert([messageId integerValue] > 0, @"Bad message id");

  KBLog(KBLogRPC|KBLogDebug, @"Requesting: %@(%@)", method, KBDescription(KBScrubSensitive(params)));

  [_client sendRequestWithMethod:method params:@[params] messageId:[messageId integerValue] completion:^(NSError *error, id result) {
    [self unregister:messageId];
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
//    if ([[KBWorkspace userDefaults] boolForKey:@"Preferences.Advanced.Record"]) {
//      if (result) [self.recorder recordResponse:method response:result sessionId:sessionId];
//    }
    [self _respondWithResult:result error:error method:method completion:completion];
  }];
  
//  if ([[KBWorkspace userDefaults] boolForKey:@"Preferences.Advanced.Record"]) {
//    [self.recorder recordRequest:method params:[_client encodeObject:params] sessionId:sessionId callback:NO];
//  }
}

- (void)registerMethod:(NSString *)method sessionId:(NSNumber *)sessionId requestHandler:(MPRequestHandler)requestHandler {
  NSParameterAssert(sessionId);
  if (!self.registrations) self.registrations = [GHODictionary dictionary];
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
    [self openAfterDelay:2 completion:^(NSError *error) {}];
  } else if (status == MPMessagePackClientStatusOpen) {
    // Awesome
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
