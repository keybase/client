#import "KBRPC.h"

@implementation KBError
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"code": @"code", @"name": @"name", @"desc": @"desc", @"fields": @"fields" }; }
@end

@implementation KBUID
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"data": @"data" }; }
@end

@implementation KBUserStatus
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"configured": @"configured", @"registered": @"registered", @"loggedIn": @"loggedIn", @"publicKeySelected": @"publicKeySelected", @"hasPrivateKey": @"hasPrivateKey" }; }
@end

@implementation KBRConfig
- (void)userStatus:(void (^)(NSError *error, KBUserStatus * userStatus))completion {

  NSDictionary *params = @{};
  [self.client sendRequestWithMethod:@"userStatus" params:params completion:^(NSError *error, NSDictionary *dict) {
    KBUserStatus *result = [MTLJSONAdapter modelOfClass:KBUserStatus.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

@end

@implementation KBLoggedInResponse
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"ok": @"ok" }; }
@end

@implementation KBRLogin
- (void)isLoggedIn:(void (^)(NSError *error, KBLoggedInResponse * loggedInResponse))completion {

  NSDictionary *params = @{};
  [self.client sendRequestWithMethod:@"isLoggedIn" params:params completion:^(NSError *error, NSDictionary *dict) {
    KBLoggedInResponse *result = [MTLJSONAdapter modelOfClass:KBLoggedInResponse.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)passwordLoginWithUsername:(NSString *)username password:(NSString *)password completion:(void (^)(NSError *error, KBUID * uID))completion {

  NSDictionary *params = @{@"username": username, @"password": password};
  [self.client sendRequestWithMethod:@"passwordLogin" params:params completion:^(NSError *error, NSDictionary *dict) {
    KBUID *result = [MTLJSONAdapter modelOfClass:KBUID.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)pubkeyLogin:(void (^)(NSError *error, KBUID * uID))completion {

  NSDictionary *params = @{};
  [self.client sendRequestWithMethod:@"pubkeyLogin" params:params completion:^(NSError *error, NSDictionary *dict) {
    KBUID *result = [MTLJSONAdapter modelOfClass:KBUID.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)logout:(void (^)(NSError *error))completion {

  NSDictionary *params = @{};
  [self.client sendRequestWithMethod:@"logout" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

- (void)switchUser:(void (^)(NSError *error))completion {

  NSDictionary *params = @{};
  [self.client sendRequestWithMethod:@"switchUser" params:params completion:^(NSError *error, NSDictionary *dict) {
    completion(error);
  }];
}

@end

@implementation KBSignUpResponse
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"uid": @"uid", @"passphraseOk": @"passphraseOk", @"postOk": @"postOk", @"writeOk": @"writeOk" }; }
@end

@implementation KBCheckUserNameResponse
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"ok": @"ok" }; }
@end

@implementation KBInvitation
+ (NSDictionary *)JSONKeyPathsByPropertyKey { return @{@"code": @"code", @"place": @"place" }; }
@end

@implementation KBRSignup
- (void)signUpWithEmail:(NSString *)email inviteCode:(NSString *)inviteCode password:(NSString *)password username:(NSString *)username completion:(void (^)(NSError *error, KBSignUpResponse * signUpResponse))completion {

  NSDictionary *params = @{@"email": email, @"inviteCode": inviteCode, @"password": password, @"username": username};
  [self.client sendRequestWithMethod:@"signUp" params:params completion:^(NSError *error, NSDictionary *dict) {
    KBSignUpResponse *result = [MTLJSONAdapter modelOfClass:KBSignUpResponse.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)checkUsernameWithUsername:(NSString *)username completion:(void (^)(NSError *error, KBCheckUserNameResponse * checkUserNameResponse))completion {

  NSDictionary *params = @{@"username": username};
  [self.client sendRequestWithMethod:@"checkUsername" params:params completion:^(NSError *error, NSDictionary *dict) {
    KBCheckUserNameResponse *result = [MTLJSONAdapter modelOfClass:KBCheckUserNameResponse.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

- (void)inviteWithEmail:(NSString *)email fullname:(NSString *)fullname notes:(NSString *)notes completion:(void (^)(NSError *error, KBInvitation * invitation))completion {

  NSDictionary *params = @{@"email": email, @"fullname": fullname, @"notes": notes};
  [self.client sendRequestWithMethod:@"invite" params:params completion:^(NSError *error, NSDictionary *dict) {
    KBInvitation *result = [MTLJSONAdapter modelOfClass:KBInvitation.class fromJSONDictionary:dict error:&error];
    completion(error, result);
  }];
}

@end
