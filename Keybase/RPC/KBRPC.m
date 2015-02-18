#import "KBRPC.h"

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

@implementation KBRImage
@end

@implementation KBRUser
@end

@implementation KBRSIGID
@end

@implementation KBRBlockRequest

- (void)announceSessionWithSid:(NSString *)sid completion:(void (^)(NSError *error))completion {
  NSArray *params = @[@{@"sid": KBRValue(sid)}];
  [self.client sendRequestWithMethod:@"keybase.1.block.announceSession" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)getWithBlockid:(NSData *)blockid uid:(KBRUID *)uid completion:(void (^)(NSError *error, NSData * bytes))completion {
  NSArray *params = @[@{@"blockid": KBRValue(blockid), @"uid": KBRValue(uid)}];
  [self.client sendRequestWithMethod:@"keybase.1.block.get" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error, 0);
  }];
}

- (void)deleteWithBlockid:(NSData *)blockid uid:(KBRUID *)uid completion:(void (^)(NSError *error))completion {
  NSArray *params = @[@{@"blockid": KBRValue(blockid), @"uid": KBRValue(uid)}];
  [self.client sendRequestWithMethod:@"keybase.1.block.delete" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)putWithBlockid:(NSData *)blockid uid:(KBRUID *)uid buf:(NSData *)buf completion:(void (^)(NSError *error))completion {
  NSArray *params = @[@{@"blockid": KBRValue(blockid), @"uid": KBRValue(uid), @"buf": KBRValue(buf)}];
  [self.client sendRequestWithMethod:@"keybase.1.block.put" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

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

@implementation KBRDeviceSigner
@end

@implementation KBRSelectSignerRes
@end

@implementation KBRDeviceDescription
@end

@implementation KBRDoctorUiRequest

- (void)promptDeviceNameWithSessionId:(NSInteger )sessionId completion:(void (^)(NSError *error, NSString * str))completion {
  NSArray *params = @[@{@"sessionId": @(sessionId)}];
  [self.client sendRequestWithMethod:@"keybase.1.doctorUi.promptDeviceName" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error, 0);
  }];
}

- (void)selectSignerWithDevices:(NSArray *)devices hasPGP:(BOOL )hasPGP completion:(void (^)(NSError *error, KBRSelectSignerRes * selectSignerRes))completion {
  NSArray *params = @[@{@"devices": KBRValue(devices), @"hasPGP": @(hasPGP)}];
  [self.client sendRequestWithMethod:@"keybase.1.doctorUi.selectSigner" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
        completion(error, nil);
        return;
      }
      KBRSelectSignerRes *result = [MTLJSONAdapter modelOfClass:KBRSelectSignerRes.class fromJSONDictionary:dict error:&error];
      completion(error, result);
  }];
}

@end

@implementation KBRGpgRequest

- (void)addGpgKey:(void (^)(NSError *error))completion {
  NSArray *params = @[@{}];
  [self.client sendRequestWithMethod:@"keybase.1.gpg.addGpgKey" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

@end

@implementation KBRGPGKey
@end

@implementation KBRSelectKeyRes
@end

@implementation KBRGpgUiRequest

- (void)wantToAddGPGKey:(void (^)(NSError *error, BOOL  b))completion {
  NSArray *params = @[@{}];
  [self.client sendRequestWithMethod:@"keybase.1.gpgUi.wantToAddGPGKey" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error, 0);
  }];
}

- (void)selectKeyAndPushOptionWithSessionId:(NSInteger )sessionId keys:(NSArray *)keys completion:(void (^)(NSError *error, KBRSelectKeyRes * selectKeyRes))completion {
  NSArray *params = @[@{@"sessionId": @(sessionId), @"keys": KBRValue(keys)}];
  [self.client sendRequestWithMethod:@"keybase.1.gpgUi.selectKeyAndPushOption" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
        completion(error, nil);
        return;
      }
      KBRSelectKeyRes *result = [MTLJSONAdapter modelOfClass:KBRSelectKeyRes.class fromJSONDictionary:dict error:&error];
      completion(error, result);
  }];
}

- (void)selectKeyWithSessionId:(NSInteger )sessionId keys:(NSArray *)keys completion:(void (^)(NSError *error, NSString * str))completion {
  NSArray *params = @[@{@"sessionId": @(sessionId), @"keys": KBRValue(keys)}];
  [self.client sendRequestWithMethod:@"keybase.1.gpgUi.selectKey" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error, 0);
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

- (void)selectWithQuery:(NSString *)query completion:(void (^)(NSError *error))completion {
  NSArray *params = @[@{@"query": KBRValue(query)}];
  [self.client sendRequestWithMethod:@"keybase.1.mykey.select" params:params completion:^(NSError *error, NSDictionary *dict) {
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

@implementation KBRSessionToken
@end

@implementation KBRQuotaRequest

- (void)verifySessionWithSession:(NSString *)session completion:(void (^)(NSError *error, KBRSessionToken * sessionToken))completion {
  NSArray *params = @[@{@"session": KBRValue(session)}];
  [self.client sendRequestWithMethod:@"keybase.1.quota.verifySession" params:params completion:^(NSError *error, NSDictionary *dict) {
    if (error) {
        completion(error, nil);
        return;
      }
      KBRSessionToken *result = [MTLJSONAdapter modelOfClass:KBRSessionToken.class fromJSONDictionary:dict error:&error];
      completion(error, result);
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
@implementation KBRAnnounceSessionRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.sid = params[0][@"sid"];
  }
  return self;
}

@end

@implementation KBRGetRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.blockid = params[0][@"blockid"];
    self.uid = [MTLJSONAdapter modelOfClass:KBRUID.class fromJSONDictionary:params[0][@"uid"] error:nil];
  }
  return self;
}

@end

@implementation KBRDeleteRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.blockid = params[0][@"blockid"];
    self.uid = [MTLJSONAdapter modelOfClass:KBRUID.class fromJSONDictionary:params[0][@"uid"] error:nil];
  }
  return self;
}

@end

@implementation KBRPutRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.blockid = params[0][@"blockid"];
    self.uid = [MTLJSONAdapter modelOfClass:KBRUID.class fromJSONDictionary:params[0][@"uid"] error:nil];
    self.buf = params[0][@"buf"];
  }
  return self;
}

@end

@implementation KBRPromptDeviceNameRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.sessionId = [params[0][@"sessionId"] integerValue];
  }
  return self;
}

@end

@implementation KBRSelectSignerRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.devices = [MTLJSONAdapter modelsOfClass:KBRDeviceDescription.class fromJSONArray:params[0][@"devices"] error:nil];
    self.hasPGP = [params[0][@"hasPGP"] boolValue];
  }
  return self;
}

@end

@implementation KBRSelectKeyAndPushOptionRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.sessionId = [params[0][@"sessionId"] integerValue];
    self.keys = [MTLJSONAdapter modelsOfClass:KBRGPGKey.class fromJSONArray:params[0][@"keys"] error:nil];
  }
  return self;
}

@end

@implementation KBRSelectKeyRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.sessionId = [params[0][@"sessionId"] integerValue];
    self.keys = [MTLJSONAdapter modelsOfClass:KBRGPGKey.class fromJSONArray:params[0][@"keys"] error:nil];
  }
  return self;
}

@end

@implementation KBRIdentifyRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.uid = [MTLJSONAdapter modelOfClass:KBRUID.class fromJSONDictionary:params[0][@"uid"] error:nil];
    self.username = params[0][@"username"];
    self.trackStatement = [params[0][@"trackStatement"] boolValue];
    self.luba = [params[0][@"luba"] boolValue];
    self.loadSelf = [params[0][@"loadSelf"] boolValue];
  }
  return self;
}

@end

@implementation KBRIdentifyDefaultRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.username = params[0][@"username"];
  }
  return self;
}

@end

@implementation KBRFinishAndPromptRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.sessionId = [params[0][@"sessionId"] integerValue];
    self.outcome = [MTLJSONAdapter modelOfClass:KBRIdentifyOutcome.class fromJSONDictionary:params[0][@"outcome"] error:nil];
  }
  return self;
}

@end

@implementation KBRFinishWebProofCheckRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.sessionId = [params[0][@"sessionId"] integerValue];
    self.rp = [MTLJSONAdapter modelOfClass:KBRRemoteProof.class fromJSONDictionary:params[0][@"rp"] error:nil];
    self.lcr = [MTLJSONAdapter modelOfClass:KBRLinkCheckResult.class fromJSONDictionary:params[0][@"lcr"] error:nil];
  }
  return self;
}

@end

@implementation KBRFinishSocialProofCheckRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.sessionId = [params[0][@"sessionId"] integerValue];
    self.rp = [MTLJSONAdapter modelOfClass:KBRRemoteProof.class fromJSONDictionary:params[0][@"rp"] error:nil];
    self.lcr = [MTLJSONAdapter modelOfClass:KBRLinkCheckResult.class fromJSONDictionary:params[0][@"lcr"] error:nil];
  }
  return self;
}

@end

@implementation KBRDisplayCryptocurrencyRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.sessionId = [params[0][@"sessionId"] integerValue];
    self.c = [MTLJSONAdapter modelOfClass:KBRCryptocurrency.class fromJSONDictionary:params[0][@"c"] error:nil];
  }
  return self;
}

@end

@implementation KBRDisplayKeyRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.sessionId = [params[0][@"sessionId"] integerValue];
    self.fokid = [MTLJSONAdapter modelOfClass:KBRFOKID.class fromJSONDictionary:params[0][@"fokid"] error:nil];
    self.diff = [MTLJSONAdapter modelOfClass:KBRTrackDiff.class fromJSONDictionary:params[0][@"diff"] error:nil];
  }
  return self;
}

@end

@implementation KBRReportLastTrackRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.sessionId = [params[0][@"sessionId"] integerValue];
    self.track = [MTLJSONAdapter modelOfClass:KBRTrackSummary.class fromJSONDictionary:params[0][@"track"] error:nil];
  }
  return self;
}

@end

@implementation KBRLaunchNetworkChecksRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.sessionId = [params[0][@"sessionId"] integerValue];
    self.id = [MTLJSONAdapter modelOfClass:KBRIdentity.class fromJSONDictionary:params[0][@"id"] error:nil];
  }
  return self;
}

@end

@implementation KBRDisplayTrackStatementRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.sessionId = [params[0][@"sessionId"] integerValue];
    self.stmt = params[0][@"stmt"];
  }
  return self;
}

@end

@implementation KBRLogRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.sessionId = [params[0][@"sessionId"] integerValue];
    self.level = [params[0][@"level"] integerValue];
    self.text = [MTLJSONAdapter modelOfClass:KBRText.class fromJSONDictionary:params[0][@"text"] error:nil];
  }
  return self;
}

@end

@implementation KBRPassphraseLoginRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.identify = [params[0][@"identify"] boolValue];
    self.username = params[0][@"username"];
    self.passphrase = params[0][@"passphrase"];
  }
  return self;
}

@end

@implementation KBRSwitchUserRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.username = params[0][@"username"];
  }
  return self;
}

@end

@implementation KBRKeyGenRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.primaryBits = [params[0][@"primaryBits"] integerValue];
    self.subkeyBits = [params[0][@"subkeyBits"] integerValue];
    self.createUids = [MTLJSONAdapter modelOfClass:KBRPgpCreateUids.class fromJSONDictionary:params[0][@"createUids"] error:nil];
    self.noPassphrase = [params[0][@"noPassphrase"] boolValue];
    self.kbPassphrase = [params[0][@"kbPassphrase"] boolValue];
    self.noNaclEddsa = [params[0][@"noNaclEddsa"] boolValue];
    self.noNaclDh = [params[0][@"noNaclDh"] boolValue];
    self.pregen = params[0][@"pregen"];
  }
  return self;
}

@end

@implementation KBRKeyGenDefaultRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.createUids = [MTLJSONAdapter modelOfClass:KBRPgpCreateUids.class fromJSONDictionary:params[0][@"createUids"] error:nil];
    self.pushPublic = [params[0][@"pushPublic"] boolValue];
    self.pushSecret = [params[0][@"pushSecret"] boolValue];
    self.passphrase = params[0][@"passphrase"];
  }
  return self;
}

@end

@implementation KBRSelectRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.query = params[0][@"query"];
  }
  return self;
}

@end

@implementation KBRProveRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.service = params[0][@"service"];
    self.username = params[0][@"username"];
    self.force = [params[0][@"force"] boolValue];
  }
  return self;
}

@end

@implementation KBRPromptOverwriteRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.sessionId = [params[0][@"sessionId"] integerValue];
    self.account = params[0][@"account"];
    self.typ = [params[0][@"typ"] integerValue];
  }
  return self;
}

@end

@implementation KBRPromptUsernameRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.sessionId = [params[0][@"sessionId"] integerValue];
    self.prompt = params[0][@"prompt"];
    self.prevError = [MTLJSONAdapter modelOfClass:KBRStatus.class fromJSONDictionary:params[0][@"prevError"] error:nil];
  }
  return self;
}

@end

@implementation KBROutputPrechecksRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.sessionId = [params[0][@"sessionId"] integerValue];
    self.text = [MTLJSONAdapter modelOfClass:KBRText.class fromJSONDictionary:params[0][@"text"] error:nil];
  }
  return self;
}

@end

@implementation KBRPreProofWarningRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.sessionId = [params[0][@"sessionId"] integerValue];
    self.text = [MTLJSONAdapter modelOfClass:KBRText.class fromJSONDictionary:params[0][@"text"] error:nil];
  }
  return self;
}

@end

@implementation KBROutputInstructionsRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.sessionId = [params[0][@"sessionId"] integerValue];
    self.instructions = [MTLJSONAdapter modelOfClass:KBRText.class fromJSONDictionary:params[0][@"instructions"] error:nil];
    self.proof = params[0][@"proof"];
  }
  return self;
}

@end

@implementation KBROkToCheckRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.sessionId = [params[0][@"sessionId"] integerValue];
    self.name = params[0][@"name"];
    self.attempt = [params[0][@"attempt"] integerValue];
  }
  return self;
}

@end

@implementation KBRDisplayRecheckWarningRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.sessionId = [params[0][@"sessionId"] integerValue];
    self.text = [MTLJSONAdapter modelOfClass:KBRText.class fromJSONDictionary:params[0][@"text"] error:nil];
  }
  return self;
}

@end

@implementation KBRVerifySessionRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.session = params[0][@"session"];
  }
  return self;
}

@end

@implementation KBRGetSecretRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.pinentry = [MTLJSONAdapter modelOfClass:KBRSecretEntryArg.class fromJSONDictionary:params[0][@"pinentry"] error:nil];
    self.terminal = [MTLJSONAdapter modelOfClass:KBRSecretEntryArg.class fromJSONDictionary:params[0][@"terminal"] error:nil];
  }
  return self;
}

@end

@implementation KBRGetNewPassphraseRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.terminalPrompt = params[0][@"terminalPrompt"];
    self.pinentryDesc = params[0][@"pinentryDesc"];
    self.pinentryPrompt = params[0][@"pinentryPrompt"];
    self.retryMessage = params[0][@"retryMessage"];
  }
  return self;
}

@end

@implementation KBRGetKeybasePassphraseRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.username = params[0][@"username"];
    self.retry = params[0][@"retry"];
  }
  return self;
}

@end

@implementation KBRCheckUsernameAvailableRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.username = params[0][@"username"];
  }
  return self;
}

@end

@implementation KBRSignupRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.email = params[0][@"email"];
    self.inviteCode = params[0][@"inviteCode"];
    self.passphrase = params[0][@"passphrase"];
    self.username = params[0][@"username"];
    self.deviceName = params[0][@"deviceName"];
  }
  return self;
}

@end

@implementation KBRInviteRequestRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.email = params[0][@"email"];
    self.fullname = params[0][@"fullname"];
    self.notes = params[0][@"notes"];
  }
  return self;
}

@end

@implementation KBRTrackRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.theirName = params[0][@"theirName"];
  }
  return self;
}

@end

@implementation KBRPromptYesNoRequestParams

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super initWithParams:params])) {
    self.text = [MTLJSONAdapter modelOfClass:KBRText.class fromJSONDictionary:params[0][@"text"] error:nil];
    self.def = [params[0][@"def"] boolValue];
  }
  return self;
}

@end
