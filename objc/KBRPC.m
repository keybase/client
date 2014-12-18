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
  [self.client sendRequestWithMethod:@"getCurrentStatus" params:params completion:^(NSError *error, NSDictionary *dict) {
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
  [self.client sendRequestWithMethod:@"passphraseLogin" params:params completion:^(NSError *error, NSDictionary *dict) {
    KBLoginRes *result = [MTLJSONAdapter modelOfClass:KBLoginRes.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)pubkeyLogin:(void (^)(NSError *error, KBLoginRes * loginRes))completion {

  NSDictionary *params = @{};
  [self.client sendRequestWithMethod:@"pubkeyLogin" params:params completion:^(NSError *error, NSDictionary *dict) {
    KBLoginRes *result = [MTLJSONAdapter modelOfClass:KBLoginRes.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)logout:(void (^)(NSError *error, KBStatus * status))completion {

  NSDictionary *params = @{};
  [self.client sendRequestWithMethod:@"logout" params:params completion:^(NSError *error, NSDictionary *dict) {
    KBStatus *result = [MTLJSONAdapter modelOfClass:KBStatus.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)switchUserWithUsername:(NSString *)username completion:(void (^)(NSError *error, KBStatus * status))completion {

  NSDictionary *params = @{@"username": username};
  [self.client sendRequestWithMethod:@"switchUser" params:params completion:^(NSError *error, NSDictionary *dict) {
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
  [self.client sendRequestWithMethod:@"checkUsernameAvailable" params:params completion:^(NSError *error, NSDictionary *dict) {
    KBStatus *result = [MTLJSONAdapter modelOfClass:KBStatus.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)signupWithEmail:(NSString *)email inviteCode:(NSString *)inviteCode passphrase:(NSString *)passphrase username:(NSString *)username completion:(void (^)(NSError *error, KBSignupRes * signupRes))completion {

  NSDictionary *params = @{@"email": email, @"inviteCode": inviteCode, @"passphrase": passphrase, @"username": username};
  [self.client sendRequestWithMethod:@"signup" params:params completion:^(NSError *error, NSDictionary *dict) {
    KBSignupRes *result = [MTLJSONAdapter modelOfClass:KBSignupRes.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)inviteRequestWithEmail:(NSString *)email fullname:(NSString *)fullname notes:(NSString *)notes completion:(void (^)(NSError *error, KBStatus * status))completion {

  NSDictionary *params = @{@"email": email, @"fullname": fullname, @"notes": notes};
  [self.client sendRequestWithMethod:@"inviteRequest" params:params completion:^(NSError *error, NSDictionary *dict) {
    KBStatus *result = [MTLJSONAdapter modelOfClass:KBStatus.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

@end

@implementation KBTrackDiff
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"type": @"type", @"displayMarkup": @"displayMarkup" }; }
@end

@implementation KBIdentifyRow
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"rowId": @"rowId", @"key": @"key", @"value": @"value", @"displayMarkup": @"displayMarkup", @"trackDiff": @"trackDiff" }; }
@end

@implementation KBIdentifyKey
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"pgpFingerprint": @"pgpFingerprint", @"KID": @"KID" }; }
@end

@implementation KBIdentifyStartResBody
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"sessionId": @"sessionId", @"whenLastTracked": @"whenLastTracked", @"key": @"key", @"web": @"web", @"social": @"social", @"cryptocurrency": @"cryptocurrency", @"deleted": @"deleted" }; }
@end

@implementation KBIdentifyStartRes
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"status": @"status", @"body": @"body" }; }
@end

@implementation KBIdentifyCheckRes
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"status": @"status", @"cachedTimestamp": @"cachedTimestamp" }; }
@end

@implementation KBIdentifyFinishResBody
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"numTrackFailures": @"numTrackFailures", @"numTrackChanges": @"numTrackChanges", @"numProofFailures": @"numProofFailures", @"numDeleted": @"numDeleted", @"numProofSuccessed": @"numProofSuccessed" }; }
@end

@implementation KBIdentifyFinishRes
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"status": @"status", @"body": @"body" }; }
@end

@implementation KBRTrack
- (void)identifyStartWithUsername:(NSString *)username completion:(void (^)(NSError *error, KBIdentifyStartRes * identifyStartRes))completion {

  NSDictionary *params = @{@"username": username};
  [self.client sendRequestWithMethod:@"identifyStart" params:params completion:^(NSError *error, NSDictionary *dict) {
    KBIdentifyStartRes *result = [MTLJSONAdapter modelOfClass:KBIdentifyStartRes.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)indentifyCheckWithSessionid:(NSInteger )sessionId rowId:(NSInteger )rowId completion:(void (^)(NSError *error, KBIdentifyCheckRes * identifyCheckRes))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId), @"rowId": @(rowId)};
  [self.client sendRequestWithMethod:@"indentifyCheck" params:params completion:^(NSError *error, NSDictionary *dict) {
    KBIdentifyCheckRes *result = [MTLJSONAdapter modelOfClass:KBIdentifyCheckRes.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)identifyFinishWithSessionid:(NSInteger )sessionId completion:(void (^)(NSError *error, KBIdentifyFinishRes * identifyFinishRes))completion {

  NSDictionary *params = @{@"sessionId": @(sessionId)};
  [self.client sendRequestWithMethod:@"identifyFinish" params:params completion:^(NSError *error, NSDictionary *dict) {
    KBIdentifyFinishRes *result = [MTLJSONAdapter modelOfClass:KBIdentifyFinishRes.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

@end
