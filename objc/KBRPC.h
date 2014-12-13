@interface KBStatus : KBRObject
@property NSInteger code;
@property NSString *name;
@property NSString *desc;
@property NSArray *fields;
@end

@interface KBLoginResBody : KBRObject
@property NSData *uid;
@end

@interface KBIsLoggedInRes : KBRObject
@property KBLoginResBody *body;
@property KBStatus *status;
@end

@interface KBIsLoggedInArg : KBRObject
@end

@interface KBPasswordLoginArg : KBRObject
@property NSString *password;
@end

@interface KBPubkeyLoginArg : KBRObject
@end

@interface KBPasswordLoginRes : KBRObject
@property KBLoginResBody *body;
@property KBStatus *status;
@end

@interface KBPubkeyLoginRes : KBRObject
@property KBLoginResBody *body;
@property KBStatus *status;
@end

@interface KBLogoutRes : KBRObject
@property KBStatus *status;
@end

@interface KBLogoutArg : KBRObject
@end

@interface KBSwitchUserRes : KBRObject
@property KBStatus *status;
@end

@interface KBSwitchUserArg : KBRObject
@property NSString *username;
@end

@interface KBCheckUsernameAvailableRes : KBRObject
@property KBStatus *status;
@end

@interface KBCheckUsernameAvailableArg : KBRObject
@property NSString *username;
@end

@interface KBCheckEmailAvailableRes : KBRObject
@property KBStatus *status;
@end

@interface KBCheckEmailAvailableArg : KBRObject
@property NSString *email;
@end

@interface KBSignupArg : KBRObject
@property NSString *email;
@property NSString *inviteCode;
@property NSString *password;
@property NSString *username;
@end

@interface KBInviteRequestArg : KBRObject
@property NSString *email;
@property NSString *fullName;
@property NSString *notes;
@end

@interface KBInviteRequestResBody : KBRObject
@property NSString *code;
@property NSInteger place;
@end

@interface KBInviteRequestRes : KBRObject
@property KBInviteRequestResBody *body;
@property KBStatus *status;
@end

@interface KBSignupResSuccess : KBRObject
@property NSData *uid;
@end

@interface KBSignupRes : KBRObject
@property KBSignupResSuccess *body;
@property KBboolean *passphraseOk;
@property KBboolean *postOk;
@property KBboolean *writeOk;
@property KBStatus *status;
@end

import "KBRObject.h"