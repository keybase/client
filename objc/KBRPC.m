#import "KBRPC.h"

@implementation KBStatus
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"code": @"code", @"name": @"name", @"desc": @"desc", @"fields": @"fields" }; }
@end

@implementation KBUID
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"data": @"data" }; }
@end

@implementation KBTrackDiff
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"type": @"type", @"displayMarkup": @"displayMarkup" }; }
@end

@implementation KBRemoteProof
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"proofType": @"proofType", @"key": @"key", @"value": @"value", @"displayMarkup": @"displayMarkup" }; }
@end

@implementation KBIdentifyRow
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"rowId": @"rowId", @"proof": @"proof", @"trackDiff": @"trackDiff" }; }
@end

@implementation KBIdentifyKey
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"pgpFingerprint": @"pgpFingerprint", @"KID": @"KID", @"trackDiff": @"trackDiff" }; }
@end

@implementation KBLoadUserArg
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"uid": @"uid", @"username": @"username", @"self": @"self" }; }
@end

@implementation KBGetCurrentStatusResBody
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"configured": @"configured", @"registered": @"registered", @"loggedIn": @"loggedIn", @"publicKeySelected": @"publicKeySelected", @"hasPrivateKey": @"hasPrivateKey" }; }
@end

@implementation KBGetCurrentStatusRes
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"body": @"body", @"status": @"status" }; }
@end

@implementation KBRConfig
- (void)getCurrentStatus:(void (^)(NSError *error, KBGetCurrentStatusRes * getCurrentStatusRes))completion {

  NSDictionary *params = @{};
  [self.client sendRequestWithMethod:@"keybase.1.config.GetCurrentStatus" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBGetCurrentStatusRes *result = [MTLJSONAdapter modelOfClass:KBGetCurrentStatusRes.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

@end

@implementation KBFOKID
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"pgpFingerprint": @"pgpFingerprint", @"KID": @"KID" }; }
@end

@implementation KBProofStatus
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"state": @"state", @"status": @"status", @"desc": @"desc" }; }
@end

@implementation KBIdentifyStartResBody
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"sessionId": @"sessionId", @"whenLastTracked": @"whenLastTracked", @"key": @"key", @"proofs": @"proofs", @"cryptocurrency": @"cryptocurrency", @"deleted": @"deleted" }; }
@end

@implementation KBIdentifyStartRes
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"status": @"status", @"body": @"body" }; }
@end

@implementation KBIdentifyCheckResBody
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"proofStatus": @"proofStatus", @"cachedTimestamp": @"cachedTimestamp", @"trackDiff": @"trackDiff" }; }
@end

@implementation KBIdentifyCheckRes
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"status": @"status", @"body": @"body" }; }
@end

@implementation KBIdentifyWaitResBody
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"numTrackFailures": @"numTrackFailures", @"numTrackChanges": @"numTrackChanges", @"numProofFailures": @"numProofFailures", @"numDeleted": @"numDeleted", @"numProofSuccesses": @"numProofSuccesses" }; }
@end

@implementation KBIdentifyWaitRes
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"status": @"status", @"body": @"body" }; }
@end

@implementation KBRIdentify
- (void)identifySelfStart:(void (^)(NSError *error, KBIdentifyStartRes * identifyStartRes))completion {

  NSDictionary *params = @{};
  [self.client sendRequestWithMethod:@"keybase.1.identify.IdentifySelfStart" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBIdentifyStartRes *result = [MTLJSONAdapter modelOfClass:KBIdentifyStartRes.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)identifyStartWithArg:(KBLoadUserArg *)arg completion:(void (^)(NSError *error, KBIdentifyStartRes * identifyStartRes))completion {

  NSDictionary *params = @{@"arg": KBRValue(arg)};
  [self.client sendRequestWithMethod:@"keybase.1.identify.IdentifyStart" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBIdentifyStartRes *result = [MTLJSONAdapter modelOfClass:KBIdentifyStartRes.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)identifyCheckWithSessionid:(NSInteger )sessionId rowId:(NSInteger )rowId completion:(void (^)(NSError *error, KBIdentifyCheckRes * identifyCheckRes))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId), @"rowId": @(rowId)};
  [self.client sendRequestWithMethod:@"keybase.1.identify.IdentifyCheck" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBIdentifyCheckRes *result = [MTLJSONAdapter modelOfClass:KBIdentifyCheckRes.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)identifyWaitWithSessionid:(NSInteger )sessionId completion:(void (^)(NSError *error, KBIdentifyWaitRes * identifyWaitRes))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId)};
  [self.client sendRequestWithMethod:@"keybase.1.identify.IdentifyWait" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBIdentifyWaitRes *result = [MTLJSONAdapter modelOfClass:KBIdentifyWaitRes.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)identifyFinishWithSessionid:(NSInteger )sessionId doRemoteTrack:(BOOL )doRemoteTrack doLocalTrack:(BOOL )doLocalTrack status:(KBStatus *)status completion:(void (^)(NSError *error, KBStatus * status))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId), @"doRemoteTrack": @(doRemoteTrack), @"doLocalTrack": @(doLocalTrack), @"status": KBRValue(status)};
  [self.client sendRequestWithMethod:@"keybase.1.identify.IdentifyFinish" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBStatus *result = [MTLJSONAdapter modelOfClass:KBStatus.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)identifySelf:(void (^)(NSError *error, KBStatus * status))completion {

  NSDictionary *params = @{};
  [self.client sendRequestWithMethod:@"keybase.1.identify.identifySelf" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBStatus *result = [MTLJSONAdapter modelOfClass:KBStatus.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

@end

@implementation KBStartRes
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"status": @"status", @"sessionId": @"sessionId" }; }
@end

@implementation KBIdentity
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"whenLastTracked": @"whenLastTracked", @"key": @"key", @"proofs": @"proofs", @"cryptocurrency": @"cryptocurrency", @"deleted": @"deleted" }; }
@end

@implementation KBProofCheckRes
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"proofId": @"proofId", @"proofStatus": @"proofStatus", @"cachedTimestamp": @"cachedTimestamp", @"trackDiff": @"trackDiff" }; }
@end

@implementation KBIdentifyOutcome
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"status": @"status", @"numTrackFailures": @"numTrackFailures", @"numTrackChanges": @"numTrackChanges", @"numProofFailures": @"numProofFailures", @"numDeleted": @"numDeleted", @"numProofSuccesses": @"numProofSuccesses" }; }
@end

@implementation KBFinishAndPromptRes
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"status": @"status", @"trackLocal": @"trackLocal", @"trackRemote": @"trackRemote" }; }
@end

@implementation KBRIdentifyui
- (void)finishAndPromptWithSessionid:(NSInteger )sessionId ioarg:(KBIdentifyOutcome *)ioarg completion:(void (^)(NSError *error, KBFinishAndPromptRes * finishAndPromptRes))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId), @"ioarg": KBRValue(ioarg)};
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.finishAndPrompt" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBFinishAndPromptRes *result = [MTLJSONAdapter modelOfClass:KBFinishAndPromptRes.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)finishWebProofCheckWithSessionid:(NSInteger )sessionId pcres:(KBProofCheckRes *)pcres completion:(void (^)(NSError *error, KBStatus * status))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId), @"pcres": KBRValue(pcres)};
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.finishWebProofCheck" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBStatus *result = [MTLJSONAdapter modelOfClass:KBStatus.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)finishSocialProofCheckWithSesionid:(NSInteger )sesionId pcres:(KBProofCheckRes *)pcres completion:(void (^)(NSError *error, KBStatus * status))completion {

  NSDictionary *params = @{@"sesionId": @(sesionId), @"pcres": KBRValue(pcres)};
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.finishSocialProofCheck" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBStatus *result = [MTLJSONAdapter modelOfClass:KBStatus.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)displayCryptocurrencyWithSessionid:(NSInteger )sessionId address:(NSString *)address completion:(void (^)(NSError *error, KBStatus * status))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId), @"address": KBRValue(address)};
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.displayCryptocurrency" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBStatus *result = [MTLJSONAdapter modelOfClass:KBStatus.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)displayKeyWithSessionid:(NSInteger )sessionId fokid:(KBFOKID *)fokid diff:(KBTrackDiff *)diff completion:(void (^)(NSError *error, KBStatus * status))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId), @"fokid": KBRValue(fokid), @"diff": KBRValue(diff)};
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.displayKey" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBStatus *result = [MTLJSONAdapter modelOfClass:KBStatus.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)reportLastTrackWithSessionid:(NSInteger )sessionId time:(NSInteger )time completion:(void (^)(NSError *error, KBStatus * status))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId), @"time": @(time)};
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.reportLastTrack" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBStatus *result = [MTLJSONAdapter modelOfClass:KBStatus.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)launchNetworkChecksWithSessionid:(NSInteger )sessionId id:(KBIdentity *)id completion:(void (^)(NSError *error, KBStatus * status))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId), @"id": KBRValue(id)};
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.launchNetworkChecks" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBStatus *result = [MTLJSONAdapter modelOfClass:KBStatus.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)start:(void (^)(NSError *error, KBStartRes * startRes))completion {

  NSDictionary *params = @{};
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.start" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBStartRes *result = [MTLJSONAdapter modelOfClass:KBStartRes.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

@end

@implementation KBLoginResBody
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"uid": @"uid" }; }
@end

@implementation KBLoginRes
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"body": @"body", @"status": @"status" }; }
@end

@implementation KBRLogin
- (void)passphraseLoginWithPassphrase:(NSString *)passphrase completion:(void (^)(NSError *error, KBLoginRes * loginRes))completion {

  NSDictionary *params = @{@"passphrase": KBRValue(passphrase)};
  [self.client sendRequestWithMethod:@"keybase.1.login.PassphraseLogin" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBLoginRes *result = [MTLJSONAdapter modelOfClass:KBLoginRes.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)pubkeyLogin:(void (^)(NSError *error, KBLoginRes * loginRes))completion {

  NSDictionary *params = @{};
  [self.client sendRequestWithMethod:@"keybase.1.login.PubkeyLogin" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBLoginRes *result = [MTLJSONAdapter modelOfClass:KBLoginRes.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)logout:(void (^)(NSError *error, KBStatus * status))completion {

  NSDictionary *params = @{};
  [self.client sendRequestWithMethod:@"keybase.1.login.Logout" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBStatus *result = [MTLJSONAdapter modelOfClass:KBStatus.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)switchUserWithUsername:(NSString *)username completion:(void (^)(NSError *error, KBStatus * status))completion {

  NSDictionary *params = @{@"username": KBRValue(username)};
  [self.client sendRequestWithMethod:@"keybase.1.login.SwitchUser" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBStatus *result = [MTLJSONAdapter modelOfClass:KBStatus.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

@end

@implementation KBSignupResBody
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"passphraseOk": @"passphraseOk", @"postOk": @"postOk", @"writeOk": @"writeOk" }; }
@end

@implementation KBSignupRes
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"body": @"body", @"status": @"status" }; }
@end

@implementation KBRSignup
- (void)checkUsernameAvailableWithUsername:(NSString *)username completion:(void (^)(NSError *error, KBStatus * status))completion {

  NSDictionary *params = @{@"username": KBRValue(username)};
  [self.client sendRequestWithMethod:@"keybase.1.signup.CheckUsernameAvailable" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBStatus *result = [MTLJSONAdapter modelOfClass:KBStatus.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)signupWithEmail:(NSString *)email inviteCode:(NSString *)inviteCode passphrase:(NSString *)passphrase username:(NSString *)username completion:(void (^)(NSError *error, KBSignupRes * signupRes))completion {

  NSDictionary *params = @{@"email": KBRValue(email), @"inviteCode": KBRValue(inviteCode), @"passphrase": KBRValue(passphrase), @"username": KBRValue(username)};
  [self.client sendRequestWithMethod:@"keybase.1.signup.Signup" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBSignupRes *result = [MTLJSONAdapter modelOfClass:KBSignupRes.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)inviteRequestWithEmail:(NSString *)email fullname:(NSString *)fullname notes:(NSString *)notes completion:(void (^)(NSError *error, KBStatus * status))completion {

  NSDictionary *params = @{@"email": KBRValue(email), @"fullname": KBRValue(fullname), @"notes": KBRValue(notes)};
  [self.client sendRequestWithMethod:@"keybase.1.signup.InviteRequest" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBStatus *result = [MTLJSONAdapter modelOfClass:KBStatus.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

@end

@implementation KBRTrack
- (void)identifySelfStart:(void (^)(NSError *error, KBIdentifyStartRes * identifyStartRes))completion {

  NSDictionary *params = @{};
  [self.client sendRequestWithMethod:@"keybase.1.track.IdentifySelfStart" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBIdentifyStartRes *result = [MTLJSONAdapter modelOfClass:KBIdentifyStartRes.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)identifyStartWithArg:(KBLoadUserArg *)arg completion:(void (^)(NSError *error, KBIdentifyStartRes * identifyStartRes))completion {

  NSDictionary *params = @{@"arg": KBRValue(arg)};
  [self.client sendRequestWithMethod:@"keybase.1.track.IdentifyStart" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBIdentifyStartRes *result = [MTLJSONAdapter modelOfClass:KBIdentifyStartRes.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)identifyCheckWithSessionid:(NSInteger )sessionId rowId:(NSInteger )rowId completion:(void (^)(NSError *error, KBIdentifyCheckRes * identifyCheckRes))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId), @"rowId": @(rowId)};
  [self.client sendRequestWithMethod:@"keybase.1.track.IdentifyCheck" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBIdentifyCheckRes *result = [MTLJSONAdapter modelOfClass:KBIdentifyCheckRes.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)identifyWaitWithSessionid:(NSInteger )sessionId completion:(void (^)(NSError *error, KBIdentifyWaitRes * identifyWaitRes))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId)};
  [self.client sendRequestWithMethod:@"keybase.1.track.IdentifyWait" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBIdentifyWaitRes *result = [MTLJSONAdapter modelOfClass:KBIdentifyWaitRes.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)identifyFinishWithSessionid:(NSInteger )sessionId doRemoteTrack:(BOOL )doRemoteTrack doLocalTrack:(BOOL )doLocalTrack status:(KBStatus *)status completion:(void (^)(NSError *error, KBStatus * status))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId), @"doRemoteTrack": @(doRemoteTrack), @"doLocalTrack": @(doLocalTrack), @"status": KBRValue(status)};
  [self.client sendRequestWithMethod:@"keybase.1.track.IdentifyFinish" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBStatus *result = [MTLJSONAdapter modelOfClass:KBStatus.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

@end
