#import "KBRPC.h"

@implementation KBStatus
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"code": @"code", @"name": @"name", @"desc": @"desc", @"fields": @"fields" }; }
@end

@implementation KBUID
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"data": @"data" }; }
@end

@implementation KBLoadUserArg
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"uid": @"uid", @"username": @"username", @"self": @"self" }; }
@end

@implementation KBFOKID
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"pgpFingerprint": @"pgpFingerprint", @"kid": @"kid" }; }
@end

@implementation KBGetCurrentStatusRes
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"configured": @"configured", @"registered": @"registered", @"loggedIn": @"loggedIn", @"publicKeySelected": @"publicKeySelected", @"hasPrivateKey": @"hasPrivateKey" }; }
@end

@implementation KBRConfig
- (void)getCurrentStatus:(void (^)(NSError *error, KBGetCurrentStatusRes * getCurrentStatusRes))completion {

  NSDictionary *params = @{};
  [self.client sendRequestWithMethod:@"keybase.1.config.getCurrentStatus" params:params completion:^(NSError *error, NSDictionary *dict) {
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
- (void)identifySelfWithSessionid:(NSInteger )sessionId completion:(void (^)(NSError *error))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId)};
  [self.client sendRequestWithMethod:@"keybase.1.identify.identifySelf" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    completion(error);
  }];
}

@end

@implementation KBTrackDiff
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"type": @"type", @"displayMarkup": @"displayMarkup" }; }
@end

@implementation KBProofStatus
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"state": @"state", @"status": @"status", @"desc": @"desc" }; }
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
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"trackLocal": @"trackLocal", @"trackRemote": @"trackRemote" }; }
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

- (void)finishWebProofCheckWithSessionid:(NSInteger )sessionId rp:(KBRemoteProof *)rp lcr:(KBLinkCheckResult *)lcr completion:(void (^)(NSError *error))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId), @"rp": KBRValue(rp), @"lcr": KBRValue(lcr)};
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.finishWebProofCheck" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    completion(error);
  }];
}

- (void)finishSocialProofCheckWithSessionid:(NSInteger )sessionId rp:(KBRemoteProof *)rp lcr:(KBLinkCheckResult *)lcr completion:(void (^)(NSError *error))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId), @"rp": KBRValue(rp), @"lcr": KBRValue(lcr)};
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.finishSocialProofCheck" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    completion(error);
  }];
}

- (void)displayCryptocurrencyWithSessionid:(NSInteger )sessionId c:(KBCryptocurrency *)c completion:(void (^)(NSError *error))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId), @"c": KBRValue(c)};
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.displayCryptocurrency" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    completion(error);
  }];
}

- (void)displayKeyWithSessionid:(NSInteger )sessionId fokid:(KBFOKID *)fokid diff:(KBTrackDiff *)diff completion:(void (^)(NSError *error))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId), @"fokid": KBRValue(fokid), @"diff": KBRValue(diff)};
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.displayKey" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    completion(error);
  }];
}

- (void)reportLastTrackWithSessionid:(NSInteger )sessionId track:(KBTrackSummary *)track completion:(void (^)(NSError *error))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId), @"track": KBRValue(track)};
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.reportLastTrack" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    completion(error);
  }];
}

- (void)launchNetworkChecksWithSessionid:(NSInteger )sessionId id:(KBIdentity *)id completion:(void (^)(NSError *error))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId), @"id": KBRValue(id)};
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.launchNetworkChecks" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    completion(error);
  }];
}

@end

@implementation KBRLogin
- (void)passphraseLogin:(void (^)(NSError *error))completion {

  NSDictionary *params = @{};
  [self.client sendRequestWithMethod:@"keybase.1.login.passphraseLogin" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    completion(error);
  }];
}

- (void)pubkeyLogin:(void (^)(NSError *error))completion {

  NSDictionary *params = @{};
  [self.client sendRequestWithMethod:@"keybase.1.login.pubkeyLogin" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    completion(error);
  }];
}

- (void)logout:(void (^)(NSError *error))completion {

  NSDictionary *params = @{};
  [self.client sendRequestWithMethod:@"keybase.1.login.logout" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    completion(error);
  }];
}

- (void)switchUserWithUsername:(NSString *)username completion:(void (^)(NSError *error))completion {

  NSDictionary *params = @{@"username": KBRValue(username)};
  [self.client sendRequestWithMethod:@"keybase.1.login.switchUser" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    completion(error);
  }];
}

@end

@implementation KBGetEmailOrUsernameRes
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"status": @"status", @"emailOrUsername": @"emailOrUsername" }; }
@end

@implementation KBGetKeybasePassphraseRes
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"status": @"status", @"passphrase": @"passphrase" }; }
@end

@implementation KBRLoginui
- (void)getEmailOrUsername:(void (^)(NSError *error, KBGetEmailOrUsernameRes * getEmailOrUsernameRes))completion {

  NSDictionary *params = @{};
  [self.client sendRequestWithMethod:@"keybase.1.loginUi.getEmailOrUsername" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBGetEmailOrUsernameRes *result = [MTLJSONAdapter modelOfClass:KBGetEmailOrUsernameRes.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)getKeybasePassphraseWithRetry:(NSString *)retry completion:(void (^)(NSError *error, KBGetKeybasePassphraseRes * getKeybasePassphraseRes))completion {

  NSDictionary *params = @{@"retry": KBRValue(retry)};
  [self.client sendRequestWithMethod:@"keybase.1.loginUi.getKeybasePassphrase" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBGetKeybasePassphraseRes *result = [MTLJSONAdapter modelOfClass:KBGetKeybasePassphraseRes.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

@end

@implementation KBSignupRes
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"passphraseOk": @"passphraseOk", @"postOk": @"postOk", @"writeOk": @"writeOk" }; }
@end

@implementation KBRSignup
- (void)checkUsernameAvailableWithUsername:(NSString *)username completion:(void (^)(NSError *error, BOOL  b))completion {

  NSDictionary *params = @{@"username": KBRValue(username)};
  [self.client sendRequestWithMethod:@"keybase.1.signup.checkUsernameAvailable" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBboolean *result = [MTLJSONAdapter modelOfClass:KBboolean.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)signupWithEmail:(NSString *)email inviteCode:(NSString *)inviteCode passphrase:(NSString *)passphrase username:(NSString *)username completion:(void (^)(NSError *error, KBSignupRes * signupRes))completion {

  NSDictionary *params = @{@"email": KBRValue(email), @"inviteCode": KBRValue(inviteCode), @"passphrase": KBRValue(passphrase), @"username": KBRValue(username)};
  [self.client sendRequestWithMethod:@"keybase.1.signup.signup" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBSignupRes *result = [MTLJSONAdapter modelOfClass:KBSignupRes.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)inviteRequestWithEmail:(NSString *)email fullname:(NSString *)fullname notes:(NSString *)notes completion:(void (^)(NSError *error))completion {

  NSDictionary *params = @{@"email": KBRValue(email), @"fullname": KBRValue(fullname), @"notes": KBRValue(notes)};
  [self.client sendRequestWithMethod:@"keybase.1.signup.inviteRequest" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    completion(error);
  }];
}

@end
