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

@implementation KBText
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"data": @"data", @"markup": @"markup" }; }
@end

@implementation KBUserInfo
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"uid": @"uid", @"username": @"username" }; }
@end

@implementation KBGetCurrentStatusRes
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"configured": @"configured", @"registered": @"registered", @"loggedIn": @"loggedIn", @"publicKeySelected": @"publicKeySelected", @"hasPrivateKey": @"hasPrivateKey", @"user": @"user" }; }
@end

@implementation KBRConfig
- (void)getCurrentStatus:(void (^)(NSError *error, KBGetCurrentStatusRes * getCurrentStatusRes))completion {

  NSArray *params = @[];
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

@implementation KBRIdentifyUi
- (void)finishAndPromptWithSessionId:(NSInteger )sessionId outcome:(KBIdentifyOutcome *)outcome completion:(void (^)(NSError *error, KBFinishAndPromptRes * finishAndPromptRes))completion {

  NSArray *params = @[@(sessionId), KBRValue(outcome)];
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.FinishAndPrompt" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
        completion(error, nil);
        return;
      }
      KBFinishAndPromptRes *result = [MTLJSONAdapter modelOfClass:KBFinishAndPromptRes.class fromJSONDictionary:dict error:&error];
      completion(error, result);
  }];
}

- (void)finishWebProofCheckWithSessionId:(NSInteger )sessionId rp:(KBRemoteProof *)rp lcr:(KBLinkCheckResult *)lcr completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@(sessionId), KBRValue(rp), KBRValue(lcr)];
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.FinishWebProofCheck" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)finishSocialProofCheckWithSessionId:(NSInteger )sessionId rp:(KBRemoteProof *)rp lcr:(KBLinkCheckResult *)lcr completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@(sessionId), KBRValue(rp), KBRValue(lcr)];
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.FinishSocialProofCheck" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)displayCryptocurrencyWithSessionId:(NSInteger )sessionId c:(KBCryptocurrency *)c completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@(sessionId), KBRValue(c)];
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.DisplayCryptocurrency" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)displayKeyWithSessionId:(NSInteger )sessionId fokid:(KBFOKID *)fokid diff:(KBTrackDiff *)diff completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@(sessionId), KBRValue(fokid), KBRValue(diff)];
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.DisplayKey" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)reportLastTrackWithSessionId:(NSInteger )sessionId track:(KBTrackSummary *)track completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@(sessionId), KBRValue(track)];
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.ReportLastTrack" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)launchNetworkChecksWithSessionId:(NSInteger )sessionId id:(KBIdentity *)id completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@(sessionId), KBRValue(id)];
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.LaunchNetworkChecks" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)warningWithSessionId:(NSInteger )sessionId msg:(NSString *)msg completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@(sessionId), KBRValue(msg)];
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.Warning" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

@end

@implementation KBRLog
- (void)logWithLevel:(KBLogLevel )level text:(KBText *)text completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@(level), KBRValue(text)];
  [self.client sendRequestWithMethod:@"keybase.1.log.Log" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

@end

@implementation KBRLogin
- (void)passphraseLoginWithIdentify:(BOOL )identify completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@(identify)];
  [self.client sendRequestWithMethod:@"keybase.1.login.PassphraseLogin" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)passphraseLoginNoIdentifyWithUsername:(NSString *)username passphrase:(NSString *)passphrase completion:(void (^)(NSError *error))completion {

  NSArray *params = @[KBRValue(username), KBRValue(passphrase)];
  [self.client sendRequestWithMethod:@"keybase.1.login.PassphraseLoginNoIdentify" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)pubkeyLogin:(void (^)(NSError *error))completion {

  NSArray *params = @[];
  [self.client sendRequestWithMethod:@"keybase.1.login.PubkeyLogin" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)logout:(void (^)(NSError *error))completion {

  NSArray *params = @[];
  [self.client sendRequestWithMethod:@"keybase.1.login.Logout" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)switchUserWithUsername:(NSString *)username completion:(void (^)(NSError *error))completion {

  NSArray *params = @[KBRValue(username)];
  [self.client sendRequestWithMethod:@"keybase.1.login.SwitchUser" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

@end

@implementation KBRLoginUi
- (void)getEmailOrUsername:(void (^)(NSError *error, NSString * str))completion {

  NSArray *params = @[];
  [self.client sendRequestWithMethod:@"keybase.1.loginUi.GetEmailOrUsername" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error, 0);
  }];
}

- (void)getKeybasePassphraseWithUsername:(NSString *)username retry:(NSString *)retry completion:(void (^)(NSError *error, NSString * str))completion {

  NSArray *params = @[KBRValue(username), KBRValue(retry)];
  [self.client sendRequestWithMethod:@"keybase.1.loginUi.GetKeybasePassphrase" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error, 0);
  }];
}

@end

@implementation KBRProve
- (void)proveWithService:(NSString *)service username:(NSString *)username force:(BOOL )force completion:(void (^)(NSError *error))completion {

  NSArray *params = @[KBRValue(service), KBRValue(username), @(force)];
  [self.client sendRequestWithMethod:@"keybase.1.prove.Prove" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

@end

@implementation KBRProveUi
- (void)promptOverwrite1WithSessionId:(NSInteger )sessionId account:(NSString *)account completion:(void (^)(NSError *error, BOOL  b))completion {

  NSArray *params = @[@(sessionId), KBRValue(account)];
  [self.client sendRequestWithMethod:@"keybase.1.proveUi.PromptOverwrite1" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error, 0);
  }];
}

- (void)promptOverwrite2WithSessionId:(NSInteger )sessionId service:(NSString *)service completion:(void (^)(NSError *error, BOOL  b))completion {

  NSArray *params = @[@(sessionId), KBRValue(service)];
  [self.client sendRequestWithMethod:@"keybase.1.proveUi.PromptOverwrite2" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error, 0);
  }];
}

- (void)promptUsernameWithSessionId:(NSInteger )sessionId prompt:(NSString *)prompt prevError:(KBStatus *)prevError completion:(void (^)(NSError *error, NSString * str))completion {

  NSArray *params = @[@(sessionId), KBRValue(prompt), KBRValue(prevError)];
  [self.client sendRequestWithMethod:@"keybase.1.proveUi.PromptUsername" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error, 0);
  }];
}

- (void)outputPrechecksWithSessionId:(NSInteger )sessionId text:(KBText *)text completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@(sessionId), KBRValue(text)];
  [self.client sendRequestWithMethod:@"keybase.1.proveUi.OutputPrechecks" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)preProofWarningWithSessionId:(NSInteger )sessionId text:(KBText *)text completion:(void (^)(NSError *error, BOOL  b))completion {

  NSArray *params = @[@(sessionId), KBRValue(text)];
  [self.client sendRequestWithMethod:@"keybase.1.proveUi.PreProofWarning" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error, 0);
  }];
}

- (void)outputInstructionsWithSessionId:(NSInteger )sessionId instructions:(KBText *)instructions proof:(NSString *)proof completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@(sessionId), KBRValue(instructions), KBRValue(proof)];
  [self.client sendRequestWithMethod:@"keybase.1.proveUi.OutputInstructions" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)okToCheckWithSessionId:(NSInteger )sessionId name:(NSString *)name attempt:(NSInteger )attempt completion:(void (^)(NSError *error, BOOL  b))completion {

  NSArray *params = @[@(sessionId), KBRValue(name), @(attempt)];
  [self.client sendRequestWithMethod:@"keybase.1.proveUi.OkToCheck" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error, 0);
  }];
}

- (void)displayRecheckWarningWithSessionId:(NSInteger )sessionId text:(KBText *)text completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@(sessionId), KBRValue(text)];
  [self.client sendRequestWithMethod:@"keybase.1.proveUi.DisplayRecheckWarning" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

@end

@implementation KBSignupRes
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"passphraseOk": @"passphraseOk", @"postOk": @"postOk", @"writeOk": @"writeOk" }; }
@end

@implementation KBRSignup
- (void)checkUsernameAvailableWithUsername:(NSString *)username completion:(void (^)(NSError *error))completion {

  NSArray *params = @[KBRValue(username)];
  [self.client sendRequestWithMethod:@"keybase.1.signup.CheckUsernameAvailable" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)signupWithEmail:(NSString *)email inviteCode:(NSString *)inviteCode passphrase:(NSString *)passphrase username:(NSString *)username completion:(void (^)(NSError *error, KBSignupRes * signupRes))completion {

  NSArray *params = @[KBRValue(email), KBRValue(inviteCode), KBRValue(passphrase), KBRValue(username)];
  [self.client sendRequestWithMethod:@"keybase.1.signup.Signup" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
        completion(error, nil);
        return;
      }
      KBSignupRes *result = [MTLJSONAdapter modelOfClass:KBSignupRes.class fromJSONDictionary:dict error:&error];
      completion(error, result);
  }];
}

- (void)inviteRequestWithEmail:(NSString *)email fullname:(NSString *)fullname notes:(NSString *)notes completion:(void (^)(NSError *error))completion {

  NSArray *params = @[KBRValue(email), KBRValue(fullname), KBRValue(notes)];
  [self.client sendRequestWithMethod:@"keybase.1.signup.InviteRequest" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

@end

@implementation KBRUi
- (void)promptYesNoWithText:(KBText *)text def:(BOOL )def completion:(void (^)(NSError *error, BOOL  b))completion {

  NSArray *params = @[KBRValue(text), @(def)];
  [self.client sendRequestWithMethod:@"keybase.1.ui.PromptYesNo" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error, 0);
  }];
}

@end
