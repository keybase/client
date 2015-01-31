#import "KBRPC.h"

@implementation KBRBlockRequest
- (void)getWithBlockid:(NSData *)blockid completion:(void (^)(NSError *error, NSData * bytes))completion {

  NSArray *params = @[@{@"blockid": KBRValue(blockid)}];
  [self.client sendRequestWithMethod:@"keybase.1.block.get" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error, 0);
  }];
}

- (void)deleteWithBlockid:(NSData *)blockid completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"blockid": KBRValue(blockid)}];
  [self.client sendRequestWithMethod:@"keybase.1.block.delete" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)putWithBlockid:(NSData *)blockid buf:(NSData *)buf completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"blockid": KBRValue(blockid), @"buf": KBRValue(buf)}];
  [self.client sendRequestWithMethod:@"keybase.1.block.put" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

@end

@implementation KBRStatus
@end

@implementation KBRUID
@end

@implementation KBRLoadUserArg
@end

@implementation KBRFOKID
@end

@implementation KBRText
@end

@implementation KBRPgpIdentity
@end

@implementation KBRUser
@end

@implementation KBRSIGID
@end

@implementation KBRGetCurrentStatusRes
@end

@implementation KBRConfigRequest
- (void)getCurrentStatus:(void (^)(NSError *error, KBRGetCurrentStatusRes * getCurrentStatusRes))completion {

  NSArray *params = @[@{}];
  [self.client sendRequestWithMethod:@"keybase.1.config.getCurrentStatus" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
        completion(error, nil);
        return;
      }
      KBRGetCurrentStatusRes *result = [MTLJSONAdapter modelOfClass:KBRGetCurrentStatusRes.class fromJSONDictionary:dict error:&error];
      completion(error, result);
  }];
}

@end

@implementation KBRTrackDiff
@end

@implementation KBRTrackSummary
@end

@implementation KBRIdentifyOutcome
+ (NSValueTransformer *)deletedJSONTransformer { return [NSValueTransformer mtl_JSONArrayTransformerWithModelClass:KBRTrackDiff.class]; }
@end

@implementation KBRIdentifyRes
@end

@implementation KBRIdentifyRequest
- (void)identifyWithUid:(KBRUID *)uid username:(NSString *)username trackStatement:(BOOL )trackStatement luba:(BOOL )luba loadSelf:(BOOL )loadSelf completion:(void (^)(NSError *error, KBRIdentifyRes * identifyRes))completion {

  NSArray *params = @[@{@"uid": KBRValue(uid), @"username": KBRValue(username), @"trackStatement": @(trackStatement), @"luba": @(luba), @"loadSelf": @(loadSelf)}];
  [self.client sendRequestWithMethod:@"keybase.1.identify.identify" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
        completion(error, nil);
        return;
      }
      KBRIdentifyRes *result = [MTLJSONAdapter modelOfClass:KBRIdentifyRes.class fromJSONDictionary:dict error:&error];
      completion(error, result);
  }];
}

- (void)identifyDefaultWithUsername:(NSString *)username completion:(void (^)(NSError *error, KBRIdentifyRes * identifyRes))completion {

  NSArray *params = @[@{@"username": KBRValue(username)}];
  [self.client sendRequestWithMethod:@"keybase.1.identify.identifyDefault" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
        completion(error, nil);
        return;
      }
      KBRIdentifyRes *result = [MTLJSONAdapter modelOfClass:KBRIdentifyRes.class fromJSONDictionary:dict error:&error];
      completion(error, result);
  }];
}

@end

@implementation KBRProofStatus
@end

@implementation KBRRemoteProof
@end

@implementation KBRIdentifyRow
@end

@implementation KBRIdentifyKey
@end

@implementation KBRCryptocurrency
@end

@implementation KBRIdentity
+ (NSValueTransformer *)proofsJSONTransformer { return [NSValueTransformer mtl_JSONArrayTransformerWithModelClass:KBRIdentifyRow.class]; }
+ (NSValueTransformer *)cryptocurrencyJSONTransformer { return [NSValueTransformer mtl_JSONArrayTransformerWithModelClass:KBRCryptocurrency.class]; }
+ (NSValueTransformer *)deletedJSONTransformer { return [NSValueTransformer mtl_JSONArrayTransformerWithModelClass:KBRTrackDiff.class]; }
@end

@implementation KBRSigHint
@end

@implementation KBRCheckResult
@end

@implementation KBRLinkCheckResult
@end

@implementation KBRFinishAndPromptRes
@end

@implementation KBRIdentifyUiRequest
- (void)finishAndPromptWithSessionId:(NSInteger )sessionId outcome:(KBRIdentifyOutcome *)outcome completion:(void (^)(NSError *error, KBRFinishAndPromptRes * finishAndPromptRes))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"outcome": KBRValue(outcome)}];
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.finishAndPrompt" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
        completion(error, nil);
        return;
      }
      KBRFinishAndPromptRes *result = [MTLJSONAdapter modelOfClass:KBRFinishAndPromptRes.class fromJSONDictionary:dict error:&error];
      completion(error, result);
  }];
}

- (void)finishWebProofCheckWithSessionId:(NSInteger )sessionId rp:(KBRRemoteProof *)rp lcr:(KBRLinkCheckResult *)lcr completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"rp": KBRValue(rp), @"lcr": KBRValue(lcr)}];
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.finishWebProofCheck" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)finishSocialProofCheckWithSessionId:(NSInteger )sessionId rp:(KBRRemoteProof *)rp lcr:(KBRLinkCheckResult *)lcr completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"rp": KBRValue(rp), @"lcr": KBRValue(lcr)}];
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.finishSocialProofCheck" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)displayCryptocurrencyWithSessionId:(NSInteger )sessionId c:(KBRCryptocurrency *)c completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"c": KBRValue(c)}];
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.displayCryptocurrency" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)displayKeyWithSessionId:(NSInteger )sessionId fokid:(KBRFOKID *)fokid diff:(KBRTrackDiff *)diff completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"fokid": KBRValue(fokid), @"diff": KBRValue(diff)}];
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.displayKey" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)reportLastTrackWithSessionId:(NSInteger )sessionId track:(KBRTrackSummary *)track completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"track": KBRValue(track)}];
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.reportLastTrack" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)launchNetworkChecksWithSessionId:(NSInteger )sessionId id:(KBRIdentity *)id completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"id": KBRValue(id)}];
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.launchNetworkChecks" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)displayTrackStatementWithSessionId:(NSInteger )sessionId stmt:(NSString *)stmt completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"stmt": KBRValue(stmt)}];
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.displayTrackStatement" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

@end

@implementation KBRLogUiRequest
- (void)logWithSessionId:(NSInteger )sessionId level:(KBRLogLevel )level text:(KBRText *)text completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"level": @(level), @"text": KBRValue(text)}];
  [self.client sendRequestWithMethod:@"keybase.1.logUi.log" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

@end

@implementation KBRLoginRequest
- (void)passphraseLoginWithIdentify:(BOOL )identify username:(NSString *)username passphrase:(NSString *)passphrase completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"identify": @(identify), @"username": KBRValue(username), @"passphrase": KBRValue(passphrase)}];
  [self.client sendRequestWithMethod:@"keybase.1.login.passphraseLogin" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)pubkeyLogin:(void (^)(NSError *error))completion {

  NSArray *params = @[@{}];
  [self.client sendRequestWithMethod:@"keybase.1.login.pubkeyLogin" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)logout:(void (^)(NSError *error))completion {

  NSArray *params = @[@{}];
  [self.client sendRequestWithMethod:@"keybase.1.login.logout" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)switchUserWithUsername:(NSString *)username completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"username": KBRValue(username)}];
  [self.client sendRequestWithMethod:@"keybase.1.login.switchUser" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

@end

@implementation KBRLoginUiRequest
- (void)getEmailOrUsername:(void (^)(NSError *error, NSString * str))completion {

  NSArray *params = @[@{}];
  [self.client sendRequestWithMethod:@"keybase.1.loginUi.getEmailOrUsername" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error, 0);
  }];
}

@end

@implementation KBRPgpCreateUids
+ (NSValueTransformer *)idsJSONTransformer { return [NSValueTransformer mtl_JSONArrayTransformerWithModelClass:KBRPgpIdentity.class]; }
@end

@implementation KBRMykeyRequest
- (void)keyGenWithPrimaryBits:(NSInteger )primaryBits subkeyBits:(NSInteger )subkeyBits createUids:(KBRPgpCreateUids *)createUids noPassphrase:(BOOL )noPassphrase kbPassphrase:(BOOL )kbPassphrase noNaclEddsa:(BOOL )noNaclEddsa noNaclDh:(BOOL )noNaclDh pregen:(NSString *)pregen completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"primaryBits": @(primaryBits), @"subkeyBits": @(subkeyBits), @"createUids": KBRValue(createUids), @"noPassphrase": @(noPassphrase), @"kbPassphrase": @(kbPassphrase), @"noNaclEddsa": @(noNaclEddsa), @"noNaclDh": @(noNaclDh), @"pregen": KBRValue(pregen)}];
  [self.client sendRequestWithMethod:@"keybase.1.mykey.keyGen" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)keyGenDefaultWithCreateUids:(KBRPgpCreateUids *)createUids pushPublic:(BOOL )pushPublic pushSecret:(BOOL )pushSecret passphrase:(NSString *)passphrase completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"createUids": KBRValue(createUids), @"pushPublic": @(pushPublic), @"pushSecret": @(pushSecret), @"passphrase": KBRValue(passphrase)}];
  [self.client sendRequestWithMethod:@"keybase.1.mykey.keyGenDefault" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)deletePrimary:(void (^)(NSError *error))completion {

  NSArray *params = @[@{}];
  [self.client sendRequestWithMethod:@"keybase.1.mykey.deletePrimary" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)show:(void (^)(NSError *error))completion {

  NSArray *params = @[@{}];
  [self.client sendRequestWithMethod:@"keybase.1.mykey.show" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

@end

@implementation KBRPushPreferences
@end

@implementation KBRMykeyUiRequest
- (void)getPushPreferences:(void (^)(NSError *error, KBRPushPreferences * pushPreferences))completion {

  NSArray *params = @[@{}];
  [self.client sendRequestWithMethod:@"keybase.1.mykeyUi.getPushPreferences" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
        completion(error, nil);
        return;
      }
      KBRPushPreferences *result = [MTLJSONAdapter modelOfClass:KBRPushPreferences.class fromJSONDictionary:dict error:&error];
      completion(error, result);
  }];
}

@end

@implementation KBRProveRequest
- (void)proveWithService:(NSString *)service username:(NSString *)username force:(BOOL )force completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"service": KBRValue(service), @"username": KBRValue(username), @"force": @(force)}];
  [self.client sendRequestWithMethod:@"keybase.1.prove.prove" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

@end

@implementation KBRProveUiRequest
- (void)promptOverwriteWithSessionId:(NSInteger )sessionId account:(NSString *)account typ:(KBRPromptOverwriteType )typ completion:(void (^)(NSError *error, BOOL  b))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"account": KBRValue(account), @"typ": @(typ)}];
  [self.client sendRequestWithMethod:@"keybase.1.proveUi.promptOverwrite" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error, 0);
  }];
}

- (void)promptUsernameWithSessionId:(NSInteger )sessionId prompt:(NSString *)prompt prevError:(KBRStatus *)prevError completion:(void (^)(NSError *error, NSString * str))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"prompt": KBRValue(prompt), @"prevError": KBRValue(prevError)}];
  [self.client sendRequestWithMethod:@"keybase.1.proveUi.promptUsername" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error, 0);
  }];
}

- (void)outputPrechecksWithSessionId:(NSInteger )sessionId text:(KBRText *)text completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"text": KBRValue(text)}];
  [self.client sendRequestWithMethod:@"keybase.1.proveUi.outputPrechecks" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)preProofWarningWithSessionId:(NSInteger )sessionId text:(KBRText *)text completion:(void (^)(NSError *error, BOOL  b))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"text": KBRValue(text)}];
  [self.client sendRequestWithMethod:@"keybase.1.proveUi.preProofWarning" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error, 0);
  }];
}

- (void)outputInstructionsWithSessionId:(NSInteger )sessionId instructions:(KBRText *)instructions proof:(NSString *)proof completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"instructions": KBRValue(instructions), @"proof": KBRValue(proof)}];
  [self.client sendRequestWithMethod:@"keybase.1.proveUi.outputInstructions" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)okToCheckWithSessionId:(NSInteger )sessionId name:(NSString *)name attempt:(NSInteger )attempt completion:(void (^)(NSError *error, BOOL  b))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"name": KBRValue(name), @"attempt": @(attempt)}];
  [self.client sendRequestWithMethod:@"keybase.1.proveUi.okToCheck" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error, 0);
  }];
}

- (void)displayRecheckWarningWithSessionId:(NSInteger )sessionId text:(KBRText *)text completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"text": KBRValue(text)}];
  [self.client sendRequestWithMethod:@"keybase.1.proveUi.displayRecheckWarning" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

@end

@implementation KBRSecretEntryArg
@end

@implementation KBRSecretEntryRes
@end

@implementation KBRSecretUiRequest
- (void)getSecretWithPinentry:(KBRSecretEntryArg *)pinentry terminal:(KBRSecretEntryArg *)terminal completion:(void (^)(NSError *error, KBRSecretEntryRes * secretEntryRes))completion {

  NSArray *params = @[@{@"pinentry": KBRValue(pinentry), @"terminal": KBRValue(terminal)}];
  [self.client sendRequestWithMethod:@"keybase.1.secretUi.getSecret" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
        completion(error, nil);
        return;
      }
      KBRSecretEntryRes *result = [MTLJSONAdapter modelOfClass:KBRSecretEntryRes.class fromJSONDictionary:dict error:&error];
      completion(error, result);
  }];
}

- (void)getNewPassphraseWithTerminalPrompt:(NSString *)terminalPrompt pinentryDesc:(NSString *)pinentryDesc pinentryPrompt:(NSString *)pinentryPrompt retryMessage:(NSString *)retryMessage completion:(void (^)(NSError *error, NSString * str))completion {

  NSArray *params = @[@{@"terminalPrompt": KBRValue(terminalPrompt), @"pinentryDesc": KBRValue(pinentryDesc), @"pinentryPrompt": KBRValue(pinentryPrompt), @"retryMessage": KBRValue(retryMessage)}];
  [self.client sendRequestWithMethod:@"keybase.1.secretUi.getNewPassphrase" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error, 0);
  }];
}

- (void)getKeybasePassphraseWithUsername:(NSString *)username retry:(NSString *)retry completion:(void (^)(NSError *error, NSString * str))completion {

  NSArray *params = @[@{@"username": KBRValue(username), @"retry": KBRValue(retry)}];
  [self.client sendRequestWithMethod:@"keybase.1.secretUi.getKeybasePassphrase" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error, 0);
  }];
}

@end

@implementation KBRSession
@end

@implementation KBRSessionRequest
- (void)currentSession:(void (^)(NSError *error, KBRSession * session))completion {

  NSArray *params = @[@{}];
  [self.client sendRequestWithMethod:@"keybase.1.session.currentSession" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
        completion(error, nil);
        return;
      }
      KBRSession *result = [MTLJSONAdapter modelOfClass:KBRSession.class fromJSONDictionary:dict error:&error];
      completion(error, result);
  }];
}

@end

@implementation KBRSignupRes
@end

@implementation KBRSignupRequest
- (void)checkUsernameAvailableWithUsername:(NSString *)username completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"username": KBRValue(username)}];
  [self.client sendRequestWithMethod:@"keybase.1.signup.checkUsernameAvailable" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)signupWithEmail:(NSString *)email inviteCode:(NSString *)inviteCode passphrase:(NSString *)passphrase username:(NSString *)username deviceName:(NSString *)deviceName completion:(void (^)(NSError *error, KBRSignupRes * signupRes))completion {

  NSArray *params = @[@{@"email": KBRValue(email), @"inviteCode": KBRValue(inviteCode), @"passphrase": KBRValue(passphrase), @"username": KBRValue(username), @"deviceName": KBRValue(deviceName)}];
  [self.client sendRequestWithMethod:@"keybase.1.signup.signup" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
        completion(error, nil);
        return;
      }
      KBRSignupRes *result = [MTLJSONAdapter modelOfClass:KBRSignupRes.class fromJSONDictionary:dict error:&error];
      completion(error, result);
  }];
}

- (void)inviteRequestWithEmail:(NSString *)email fullname:(NSString *)fullname notes:(NSString *)notes completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"email": KBRValue(email), @"fullname": KBRValue(fullname), @"notes": KBRValue(notes)}];
  [self.client sendRequestWithMethod:@"keybase.1.signup.inviteRequest" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

@end

@implementation KBRTrackRequest
- (void)trackWithTheirName:(NSString *)theirName completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"theirName": KBRValue(theirName)}];
  [self.client sendRequestWithMethod:@"keybase.1.track.track" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

@end

@implementation KBRUiRequest
- (void)promptYesNoWithText:(KBRText *)text def:(BOOL )def completion:(void (^)(NSError *error, BOOL  b))completion {

  NSArray *params = @[@{@"text": KBRValue(text), @"def": @(def)}];
  [self.client sendRequestWithMethod:@"keybase.1.ui.promptYesNo" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error, 0);
  }];
}

@end
