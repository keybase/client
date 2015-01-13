#import "KBRPC.h"

@implementation KBStatus
@end

@implementation KBUID
@end

@implementation KBLoadUserArg
@end

@implementation KBFOKID
@end

@implementation KBText
@end

@implementation KBUserInfo
@end

@implementation KBGetCurrentStatusRes
@end

@implementation KBRConfig
- (void)getCurrentStatus:(void (^)(NSError *error, KBGetCurrentStatusRes * getCurrentStatusRes))completion {

  NSArray *params = @[@{}];
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
@end

@implementation KBTrackDiff
@end

@implementation KBProofStatus
@end

@implementation KBRemoteProof
@end

@implementation KBIdentifyRow
@end

@implementation KBIdentifyKey
@end

@implementation KBCryptocurrency
@end

@implementation KBIdentity
@end

@implementation KBSigHint
@end

@implementation KBCheckResult
@end

@implementation KBLinkCheckResult
@end

@implementation KBTrackSummary
@end

@implementation KBIdentifyOutcome
@end

@implementation KBFinishAndPromptRes
@end

@implementation KBRIdentifyUi
- (void)finishAndPromptWithSessionId:(NSInteger )sessionId outcome:(KBIdentifyOutcome *)outcome completion:(void (^)(NSError *error, KBFinishAndPromptRes * finishAndPromptRes))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"outcome": KBRValue(outcome)}];
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.finishAndPrompt" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
        completion(error, nil);
        return;
      }
      KBFinishAndPromptRes *result = [MTLJSONAdapter modelOfClass:KBFinishAndPromptRes.class fromJSONDictionary:dict error:&error];
      completion(error, result);
  }];
}

- (void)finishWebProofCheckWithSessionId:(NSInteger )sessionId rp:(KBRemoteProof *)rp lcr:(KBLinkCheckResult *)lcr completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"rp": KBRValue(rp), @"lcr": KBRValue(lcr)}];
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.finishWebProofCheck" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)finishSocialProofCheckWithSessionId:(NSInteger )sessionId rp:(KBRemoteProof *)rp lcr:(KBLinkCheckResult *)lcr completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"rp": KBRValue(rp), @"lcr": KBRValue(lcr)}];
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.finishSocialProofCheck" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)displayCryptocurrencyWithSessionId:(NSInteger )sessionId c:(KBCryptocurrency *)c completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"c": KBRValue(c)}];
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.displayCryptocurrency" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)displayKeyWithSessionId:(NSInteger )sessionId fokid:(KBFOKID *)fokid diff:(KBTrackDiff *)diff completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"fokid": KBRValue(fokid), @"diff": KBRValue(diff)}];
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.displayKey" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)reportLastTrackWithSessionId:(NSInteger )sessionId track:(KBTrackSummary *)track completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"track": KBRValue(track)}];
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.reportLastTrack" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)launchNetworkChecksWithSessionId:(NSInteger )sessionId id:(KBIdentity *)id completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"id": KBRValue(id)}];
  [self.client sendRequestWithMethod:@"keybase.1.identifyUi.launchNetworkChecks" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

@end

@implementation KBRLogUi
- (void)logWithSessionId:(NSInteger )sessionId level:(KBLogLevel )level text:(KBText *)text completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"level": @(level), @"text": KBRValue(text)}];
  [self.client sendRequestWithMethod:@"keybase.1.logUi.log" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

@end

@implementation KBRLogin
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

@implementation KBPgpIdentity
@end

@implementation KBRLoginUi
- (void)getEmailOrUsername:(void (^)(NSError *error, NSString * str))completion {

  NSArray *params = @[@{}];
  [self.client sendRequestWithMethod:@"keybase.1.loginUi.getEmailOrUsername" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error, 0);
  }];
}

@end

@implementation KBRMykey
- (void)keyGenWithPrimaryBits:(NSInteger )primaryBits subkeyBits:(NSInteger )subkeyBits ids:(NSArray *)ids noPassphrase:(BOOL )noPassphrase kbPassphrase:(BOOL )kbPassphrase noNaclEddsa:(BOOL )noNaclEddsa noNaclDh:(BOOL )noNaclDh pregen:(NSString *)pregen completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"primaryBits": @(primaryBits), @"subkeyBits": @(subkeyBits), @"ids": KBRValue(ids), @"noPassphrase": @(noPassphrase), @"kbPassphrase": @(kbPassphrase), @"noNaclEddsa": @(noNaclEddsa), @"noNaclDh": @(noNaclDh), @"pregen": KBRValue(pregen)}];
  [self.client sendRequestWithMethod:@"keybase.1.mykey.keyGen" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)keyGenSimpleWithIds:(NSArray *)ids completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"ids": KBRValue(ids)}];
  [self.client sendRequestWithMethod:@"keybase.1.mykey.keyGenSimple" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

@end

@implementation KBPushPreferences
@end

@implementation KBRMykeyUi
- (void)getPushPreferences:(void (^)(NSError *error, KBPushPreferences * pushPreferences))completion {

  NSArray *params = @[@{}];
  [self.client sendRequestWithMethod:@"keybase.1.mykeyUi.getPushPreferences" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
        completion(error, nil);
        return;
      }
      KBPushPreferences *result = [MTLJSONAdapter modelOfClass:KBPushPreferences.class fromJSONDictionary:dict error:&error];
      completion(error, result);
  }];
}

@end

@implementation KBRProve
- (void)proveWithService:(NSString *)service username:(NSString *)username force:(BOOL )force completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"service": KBRValue(service), @"username": KBRValue(username), @"force": @(force)}];
  [self.client sendRequestWithMethod:@"keybase.1.prove.prove" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

@end

@implementation KBRProveUi
- (void)promptOverwrite1WithSessionId:(NSInteger )sessionId account:(NSString *)account completion:(void (^)(NSError *error, BOOL  b))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"account": KBRValue(account)}];
  [self.client sendRequestWithMethod:@"keybase.1.proveUi.promptOverwrite1" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error, 0);
  }];
}

- (void)promptOverwrite2WithSessionId:(NSInteger )sessionId service:(NSString *)service completion:(void (^)(NSError *error, BOOL  b))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"service": KBRValue(service)}];
  [self.client sendRequestWithMethod:@"keybase.1.proveUi.promptOverwrite2" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error, 0);
  }];
}

- (void)promptUsernameWithSessionId:(NSInteger )sessionId prompt:(NSString *)prompt prevError:(KBStatus *)prevError completion:(void (^)(NSError *error, NSString * str))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"prompt": KBRValue(prompt), @"prevError": KBRValue(prevError)}];
  [self.client sendRequestWithMethod:@"keybase.1.proveUi.promptUsername" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error, 0);
  }];
}

- (void)outputPrechecksWithSessionId:(NSInteger )sessionId text:(KBText *)text completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"text": KBRValue(text)}];
  [self.client sendRequestWithMethod:@"keybase.1.proveUi.outputPrechecks" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)preProofWarningWithSessionId:(NSInteger )sessionId text:(KBText *)text completion:(void (^)(NSError *error, BOOL  b))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"text": KBRValue(text)}];
  [self.client sendRequestWithMethod:@"keybase.1.proveUi.preProofWarning" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error, 0);
  }];
}

- (void)outputInstructionsWithSessionId:(NSInteger )sessionId instructions:(KBText *)instructions proof:(NSString *)proof completion:(void (^)(NSError *error))completion {

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

- (void)displayRecheckWarningWithSessionId:(NSInteger )sessionId text:(KBText *)text completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"sessionId": @(sessionId), @"text": KBRValue(text)}];
  [self.client sendRequestWithMethod:@"keybase.1.proveUi.displayRecheckWarning" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

@end

@implementation KBSecretEntryArg
@end

@implementation KBSecretEntryRes
@end

@implementation KBRSecretUi
- (void)getSecretWithPinentry:(KBSecretEntryArg *)pinentry terminal:(KBSecretEntryArg *)terminal completion:(void (^)(NSError *error, KBSecretEntryRes * secretEntryRes))completion {

  NSArray *params = @[@{@"pinentry": KBRValue(pinentry), @"terminal": KBRValue(terminal)}];
  [self.client sendRequestWithMethod:@"keybase.1.secretUi.getSecret" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
        completion(error, nil);
        return;
      }
      KBSecretEntryRes *result = [MTLJSONAdapter modelOfClass:KBSecretEntryRes.class fromJSONDictionary:dict error:&error];
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

@implementation KBSignupRes
@end

@implementation KBRSignup
- (void)checkUsernameAvailableWithUsername:(NSString *)username completion:(void (^)(NSError *error))completion {

  NSArray *params = @[@{@"username": KBRValue(username)}];
  [self.client sendRequestWithMethod:@"keybase.1.signup.checkUsernameAvailable" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)signupWithEmail:(NSString *)email inviteCode:(NSString *)inviteCode passphrase:(NSString *)passphrase username:(NSString *)username completion:(void (^)(NSError *error, KBSignupRes * signupRes))completion {

  NSArray *params = @[@{@"email": KBRValue(email), @"inviteCode": KBRValue(inviteCode), @"passphrase": KBRValue(passphrase), @"username": KBRValue(username)}];
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

  NSArray *params = @[@{@"email": KBRValue(email), @"fullname": KBRValue(fullname), @"notes": KBRValue(notes)}];
  [self.client sendRequestWithMethod:@"keybase.1.signup.inviteRequest" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

@end

@implementation KBRUi
- (void)promptYesNoWithText:(KBText *)text def:(BOOL )def completion:(void (^)(NSError *error, BOOL  b))completion {

  NSArray *params = @[@{@"text": KBRValue(text), @"def": @(def)}];
  [self.client sendRequestWithMethod:@"keybase.1.ui.promptYesNo" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error, 0);
  }];
}

@end
