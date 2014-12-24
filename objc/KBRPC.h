#import "KBRObject.h"
#import "KBRRequest.h"

@interface KBStatus : KBRObject
@property NSInteger code;
@property NSString *name;
@property NSString *desc;
@property NSArray *fields;
@end

@interface KBUID : KBRObject
@property NSData *data;
@end

@interface KBGetCurrentStatusResBody : KBRObject
@property BOOL configured;
@property BOOL registered;
@property BOOL loggedIn;
@property BOOL publicKeySelected;
@property BOOL hasPrivateKey;
@end

@interface KBGetCurrentStatusRes : KBRObject
@property KBGetCurrentStatusResBody *body;
@property KBStatus *status;
@end

@interface KBRConfig : KBRRequest
- (void)getCurrentStatus:(void (^)(NSError *error, KBGetCurrentStatusRes * getCurrentStatusRes))completion;

@end

@interface KBLoginResBody : KBRObject
@property KBUID *uid;
@end

@interface KBLoginRes : KBRObject
@property KBLoginResBody *body;
@property KBStatus *status;
@end

@interface KBRLogin : KBRRequest
- (void)passphraseLoginWithPassphrase:(NSString *)passphrase completion:(void (^)(NSError *error, KBLoginRes * loginRes))completion;

- (void)pubkeyLogin:(void (^)(NSError *error, KBLoginRes * loginRes))completion;

- (void)logout:(void (^)(NSError *error, KBStatus * status))completion;

- (void)switchUserWithUsername:(NSString *)username completion:(void (^)(NSError *error, KBStatus * status))completion;

@end

@interface KBSignupResBody : KBRObject
@property BOOL passphraseOk;
@property BOOL postOk;
@property BOOL writeOk;
@end

@interface KBSignupRes : KBRObject
@property KBSignupResBody *body;
@property KBStatus *status;
@end

@interface KBRSignup : KBRRequest
- (void)checkUsernameAvailableWithUsername:(NSString *)username completion:(void (^)(NSError *error, KBStatus * status))completion;

- (void)signupWithEmail:(NSString *)email inviteCode:(NSString *)inviteCode passphrase:(NSString *)passphrase username:(NSString *)username completion:(void (^)(NSError *error, KBSignupRes * signupRes))completion;

- (void)inviteRequestWithEmail:(NSString *)email fullname:(NSString *)fullname notes:(NSString *)notes completion:(void (^)(NSError *error, KBStatus * status))completion;

@end

typedef NS_ENUM (NSInteger, KBTrackDiffType) {
	KBNone, 
	KBError, 
	KBClash, 
	KBDeleted, 
	KBUpgraded, 
	KBNew, 
	KBRemote_fail, 
	KBRemote_working, 
	KBRemote_changed, 
};
@interface KBTrackDiff : KBRObject
@property KBTrackDiffType type;
@property NSString *displayMarkup;
@end

@interface KBRemoteProof : KBRObject
@property NSInteger proofType;
@property NSString *key;
@property NSString *value;
@property NSString *displayMarkup;
@end

@interface KBIdentifyRow : KBRObject
@property NSInteger rowId;
@property KBRemoteProof *proof;
@property KBTrackDiff *trackDiff;
@end

@interface KBIdentifyKey : KBRObject
@property NSData *pgpFingerprint;
@property NSData *KID;
@property KBTrackDiff *trackDiff;
@end

@interface KBIdentifyStartResBody : KBRObject
@property NSInteger sessionId;
@property NSInteger whenLastTracked;
@property KBIdentifyKey *key;
@property NSArray *proofs;
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
@property KBTrackDiff *trackDiff;
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

@interface KBRTrack : KBRRequest
- (void)identifySelfStart:(void (^)(NSError *error, KBIdentifyStartRes * identifyStartRes))completion;

- (void)identifyStartWithUsername:(NSString *)username completion:(void (^)(NSError *error, KBIdentifyStartRes * identifyStartRes))completion;

- (void)identifyCheckWithSessionid:(NSInteger )sessionId rowId:(NSInteger )rowId completion:(void (^)(NSError *error, KBIdentifyCheckRes * identifyCheckRes))completion;

- (void)identifyFinishWithSessionid:(NSInteger )sessionId completion:(void (^)(NSError *error, KBIdentifyFinishRes * identifyFinishRes))completion;

@end
