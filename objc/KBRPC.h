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

@interface KBTrackDiff : KBRObject
@property KBTrackDiffType *type;
@property NSString *displayMarkup;
@end

@interface KBIdentifyRow : KBRObject
@property NSInteger rowId;
@property NSString *key;
@property NSString *value;
@property NSString *displayMarkup;
@property KBTrackDiff *trackDiff;
@end

@interface KBIdentifyKey : KBRObject
@property KBbytes *pgpFingerprint;
@property KBbytes *KID;
@end

@interface KBIdentifyStartResBody : KBRObject
@property NSInteger sessionId;
@property NSInteger whenLastTracked;
@property KBIdentifyKey *key;
@property NSArray *web;
@property NSArray *social;
@property NSArray *cryptocurrency;
@property NSArray *deleted;
@end

@interface KBIdentifyStartRes : KBRObject
@property KBStatus *status;
@property KBIdentifyStartResBody *body;
@end

@interface KBIdentifyCheckRes : KBRObject
@property KBStatus *status;
@property NSInteger cachedTimestamp;
@end

@interface KBIdentifyFinishResBody : KBRObject
@property NSInteger numTrackFailures;
@property NSInteger numTrackChanges;
@property NSInteger numProofFailures;
@property NSInteger numDeleted;
@property NSInteger numProofSuccessed;
@end

@interface KBIdentifyFinishRes : KBRObject
@property KBStatus *status;
@property KBIdentifyFinishResBody *body;
@end

import "KBRObject.h"