#import "KBRPC.h"

@implementation KBStatus
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"code": @"code", @"name": @"name", @"desc": @"desc", @"fields": @"fields" }; }
@end

@implementation KBUID
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"data": @"data" }; }
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

@implementation KBLoginResBody
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"uid": @"uid" }; }
@end

@implementation KBLoginRes
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"body": @"body", @"status": @"status" }; }
@end

@implementation KBRLogin
- (void)passphraseLoginWithPassphrase:(NSString *)passphrase completion:(void (^)(NSError *error, KBLoginRes * loginRes))completion {

  NSDictionary *params = @{@"passphrase": passphrase};
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

  NSDictionary *params = @{@"username": username};
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

  NSDictionary *params = @{@"username": username};
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

  NSDictionary *params = @{@"email": email, @"inviteCode": inviteCode, @"passphrase": passphrase, @"username": username};
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

  NSDictionary *params = @{@"email": email, @"fullname": fullname, @"notes": notes};
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

@implementation KBIdentifyStartResBody
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"sessionId": @"sessionId", @"whenLastTracked": @"whenLastTracked", @"key": @"key", @"proofs": @"proofs", @"cryptocurrency": @"cryptocurrency", @"deleted": @"deleted" }; }
@end

@implementation KBIdentifyStartRes
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"status": @"status", @"body": @"body" }; }
@end

@implementation KBProofStatus
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"state": @"state", @"status": @"status", @"desc": @"desc" }; }
@end

@implementation KBIdentifyCheckResBody
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"status": @"status", @"cachedTimestamp": @"cachedTimestamp", @"trackDiff": @"trackDiff" }; }
@end

@implementation KBIdentifyCheckRes
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"status": @"status", @"body": @"body" }; }
@end

@implementation KBIdentifyFinishResBody
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"numTrackFailures": @"numTrackFailures", @"numTrackChanges": @"numTrackChanges", @"numProofFailures": @"numProofFailures", @"numDeleted": @"numDeleted", @"numProofSuccessed": @"numProofSuccessed" }; }
@end

@implementation KBIdentifyFinishRes
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"status": @"status", @"body": @"body" }; }
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

- (void)identifyStartWithUsername:(NSString *)username completion:(void (^)(NSError *error, KBIdentifyStartRes * identifyStartRes))completion {

  NSDictionary *params = @{@"username": username};
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

- (void)identifyFinishWithSessionid:(NSInteger )sessionId completion:(void (^)(NSError *error, KBIdentifyFinishRes * identifyFinishRes))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId)};
  [self.client sendRequestWithMethod:@"keybase.1.track.IdentifyFinish" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
      completion(error, nil);
      return;
    }
    KBIdentifyFinishRes *result = [MTLJSONAdapter modelOfClass:KBIdentifyFinishRes.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

@end
