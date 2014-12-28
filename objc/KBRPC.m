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

@implementation KBFOKID
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"pgpFingerprint": @"pgpFingerprint", @"kid": @"kid" }; }
@end

@implementation KBProofStatus
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"state": @"state", @"status": @"status", @"desc": @"desc" }; }
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

@implementation KBRIdentify
- (void)identifySelfWithSessionid:(NSInteger )sessionId completion:(void (^)(NSError *error, KBStatus * status))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId)};
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

@implementation KBCryptocurrency
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"rowId": @"rowId", @"pkhash": @"pkhash", @"address": @"address" }; }
@end

@implementation KBIdentity
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"status": @"status", @"whenLastTracked": @"whenLastTracked", @"key": @"key", @"proofs": @"proofs", @"cryptocurrency": @"cryptocurrency", @"deleted": @"deleted" }; }
@end

@implementation KBSigHint
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"remoteId": @"remoteId", @"humanUrl": @"humanUrl", @"apiUrl": @"apiUrl", @"checkText": @"checkText" }; }
@end

@implementation KBCheckResult
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"proofStatus": @"proofStatus", @"timestamp": @"timestamp", @"displayMarkup": @"displayMarkup" }; }
@end

@implementation KBLinkCheckResult
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"proofId": @"proofId", @"proofStatus": @"proofStatus", @"cached": @"cached", @"diff": @"diff", @"remoteDiff": @"remoteDiff", @"hint": @"hint" }; }
@end

@implementation KBTrackSummary
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"time": @"time", @"isRemote": @"isRemote" }; }
@end

@implementation KBIdentifyOutcome
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"status": @"status", @"warnings": @"warnings", @"trackUsed": @"trackUsed", @"numTrackFailures": @"numTrackFailures", @"numTrackChanges": @"numTrackChanges", @"numProofFailures": @"numProofFailures", @"numDeleted": @"numDeleted", @"numProofSuccesses": @"numProofSuccesses", @"deleted": @"deleted" }; }
@end

@implementation KBFinishAndPromptRes
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"status": @"status", @"trackLocal": @"trackLocal", @"trackRemote": @"trackRemote" }; }
@end

@implementation KBRIdentifyui
- (void)finishAndPromptWithSessionid:(NSInteger )sessionId outcome:(KBIdentifyOutcome *)outcome completion:(void (^)(NSError *error, KBFinishAndPromptRes * finishAndPromptRes))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId), @"outcome": KBRValue(outcome)};
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.finishAndPrompt" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBFinishAndPromptRes *result = [MTLJSONAdapter modelOfClass:KBFinishAndPromptRes.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)finishWebProofCheckWithSessionid:(NSInteger )sessionId rp:(KBRemoteProof *)rp lcr:(KBLinkCheckResult *)lcr completion:(void (^)(NSError *error, KBStatus * status))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId), @"rp": KBRValue(rp), @"lcr": KBRValue(lcr)};
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.finishWebProofCheck" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBStatus *result = [MTLJSONAdapter modelOfClass:KBStatus.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)finishSocialProofCheckWithSessionid:(NSInteger )sessionId rp:(KBRemoteProof *)rp lcr:(KBLinkCheckResult *)lcr completion:(void (^)(NSError *error, KBStatus * status))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId), @"rp": KBRValue(rp), @"lcr": KBRValue(lcr)};
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.finishSocialProofCheck" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBStatus *result = [MTLJSONAdapter modelOfClass:KBStatus.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)displayCryptocurrencyWithSessionid:(NSInteger )sessionId c:(KBCryptocurrency *)c completion:(void (^)(NSError *error, KBStatus * status))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId), @"c": KBRValue(c)};
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

- (void)reportLastTrackWithSessionid:(NSInteger )sessionId track:(KBTrackSummary *)track completion:(void (^)(NSError *error, KBStatus * status))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId), @"track": KBRValue(track)};
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
