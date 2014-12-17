@interface KBStatus : KBRObject
@property NSInteger code;
@property NSString *name;
@property NSString *desc;
@property NSArray *fields;
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

@interface KBLoginRes : KBRObject
@property KBLoginResBody *body;
@property KBStatus *status;
@end

@interface KBSignupResBody : KBRObject
@property KBboolean *passphraseOk;
@property KBboolean *postOk;
@property KBboolean *writeOk;
@end

@interface KBSignupRes : KBRObject
@property KBSignupResBody *body;
@property KBStatus *status;
@end

import "KBRObject.h"