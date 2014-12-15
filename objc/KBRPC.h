@interface KBStatus : KBRObject
@property NSInteger code;
@property NSString *name;
@property NSString *desc;
@property NSArray *fields;
@end

@interface KBGetCurrentStatusArg : KBRObject
@end

@interface KBGetCurrentStatusResBody : KBRObject
@property KBboolean *configured;
@property KBboolean *registered;
@property KBboolean *loggedIn;
@property KBboolean *publicKeySelected;
@property KBboolean *hasPrivateKey;
@end

@interface KBGetCurrentStatusRes : KBRObject
@property KBGetCurrentStatusResBody *body;
@property KBStatus *status;
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

@interface KBSignupArg : KBRObject
@property NSString *email;
@property NSString *inviteCode;
@property NSString *passphrase;
@property NSString *username;
@end

@interface KBInviteRequestArg : KBRObject
@property NSString *email;
@property NSString *fullname;
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

@interface KBSignupResBody : KBRObject
@property KBSignupResSuccess *success;
@property KBboolean *passphraseOk;
@property KBboolean *postOk;
@property KBboolean *writeOk;
@end

@interface KBSignupRes : KBRObject
@property KBSignupResBody *body;
@property KBStatus *status;
@end

import "KBRObject.h"