#import "KBRObject.h"
#import "KBRRequest.h"

@interface KBError : KBRObject
@property NSInteger code;
@property NSString *name;
@property NSString *desc;
@property NSArray *fields;
@end

@interface KBUID : KBRObject
@property NSString *data;
@end

@interface KBUserStatus : KBRObject
@property BOOL configured;
@property BOOL registered;
@property BOOL loggedIn;
@property BOOL publicKeySelected;
@property BOOL hasPrivateKey;
@end

@interface KBRConfig : KBRRequest
- (void)userStatus:(void (^)(NSError *error, KBUserStatus * userStatus))completion;

@end

@interface KBLoggedInResponse : KBRObject
@property BOOL ok;
@end

@interface KBRLogin : KBRRequest
- (void)isLoggedIn:(void (^)(NSError *error, KBLoggedInResponse * loggedInResponse))completion;

- (void)passwordLoginWithUsername:(NSString *)username password:(NSString *)password completion:(void (^)(NSError *error, KBUID * uID))completion;

- (void)pubkeyLogin:(void (^)(NSError *error, KBUID * uID))completion;

- (void)logout:(void (^)(NSError *error))completion;

- (void)switchUser:(void (^)(NSError *error))completion;

@end

@interface KBSignUpResponse : KBRObject
@property KBUID *uid;
@property BOOL passphraseOk;
@property BOOL postOk;
@property BOOL writeOk;
@end

@interface KBCheckUserNameResponse : KBRObject
@property BOOL ok;
@end

@interface KBInvitation : KBRObject
@property NSString *code;
@property NSInteger place;
@end

@interface KBRSignup : KBRRequest
- (void)signUpWithEmail:(NSString *)email inviteCode:(NSString *)inviteCode password:(NSString *)password username:(NSString *)username completion:(void (^)(NSError *error, KBSignUpResponse * signUpResponse))completion;

- (void)checkUsernameWithUsername:(NSString *)username completion:(void (^)(NSError *error, KBCheckUserNameResponse * checkUserNameResponse))completion;

- (void)inviteWithEmail:(NSString *)email fullname:(NSString *)fullname notes:(NSString *)notes completion:(void (^)(NSError *error, KBInvitation * invitation))completion;

@end
