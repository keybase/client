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

@interface KBLoadUserArg : KBRObject
@property KBUID *uid;
@property NSString *username;
@property BOOL self;
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

@interface KBFOKID : KBRObject
@property NSData *pgpFingerprint;
@property NSData *KID;
@end

@interface KBProofStatus : KBRObject
@property NSInteger state;
@property NSInteger status;
@property NSString *desc;
@end

@interface KBStartRes : KBRObject
@property KBStatus *status;
@property NSInteger sessionId;
@end

@interface KBIdentity : KBRObject
@property NSInteger whenLastTracked;
@property KBIdentifyKey *key;
@property NSArray *proofs;
@property NSArray *cryptocurrency;
@property NSArray *deleted;
@end

@interface KBProofCheckRes : KBRObject
@property NSInteger proofId;
@property KBProofStatus *proofStatus;
@property NSInteger cachedTimestamp;
@property KBTrackDiff *trackDiff;
@end

@interface KBIdentifyOutcome : KBRObject
@property KBStatus *status;
@property NSInteger numTrackFailures;
@property NSInteger numTrackChanges;
@property NSInteger numProofFailures;
@property NSInteger numDeleted;
@property NSInteger numProofSuccesses;
@end

@interface KBFinishAndPromptRes : KBRObject
@property KBStatus *status;
@property BOOL trackLocal;
@property BOOL trackRemote;
@end

@interface KBRIdentifyui : KBRRequest
- (void)finishAndPromptWithSessionid:(NSInteger )sessionId ioarg:(KBIdentifyOutcome *)ioarg completion:(void (^)(NSError *error, KBFinishAndPromptRes * finishAndPromptRes))completion;

- (void)finishWebProofCheckWithSessionid:(NSInteger )sessionId pcres:(KBProofCheckRes *)pcres completion:(void (^)(NSError *error, KBStatus * status))completion;

- (void)finishSocialProofCheckWithSesionid:(NSInteger )sesionId pcres:(KBProofCheckRes *)pcres completion:(void (^)(NSError *error, KBStatus * status))completion;

- (void)displayCryptocurrencyWithSessionid:(NSInteger )sessionId address:(NSString *)address completion:(void (^)(NSError *error, KBStatus * status))completion;

- (void)displayKeyWithSessionid:(NSInteger )sessionId fokid:(KBFOKID *)fokid diff:(KBTrackDiff *)diff completion:(void (^)(NSError *error, KBStatus * status))completion;

- (void)reportLastTrackWithSessionid:(NSInteger )sessionId time:(NSInteger )time completion:(void (^)(NSError *error, KBStatus * status))completion;

- (void)launchNetworkChecksWithSessionid:(NSInteger )sessionId id:(KBIdentity *)id completion:(void (^)(NSError *error, KBStatus * status))completion;

- (void)start:(void (^)(NSError *error, KBStartRes * startRes))completion;

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

@interface KBIdentifyCheckResBody : KBRObject
@property KBProofStatus *proofStatus;
@property NSInteger cachedTimestamp;
@property KBTrackDiff *trackDiff;
@end

@interface KBIdentifyCheckRes : KBRObject
@property KBStatus *status;
@property KBIdentifyCheckResBody *body;
@end

@interface KBIdentifyWaitResBody : KBRObject
@property NSInteger numTrackFailures;
@property NSInteger numTrackChanges;
@property NSInteger numProofFailures;
@property NSInteger numDeleted;
@property NSInteger numProofSuccesses;
@end

@interface KBIdentifyWaitRes : KBRObject
@property KBStatus *status;
@property KBIdentifyWaitResBody *body;
@end

@interface KBRTrack : KBRRequest
- (void)identifySelfStart:(void (^)(NSError *error, KBIdentifyStartRes * identifyStartRes))completion;

- (void)identifyStartWithArg:(KBLoadUserArg *)arg completion:(void (^)(NSError *error, KBIdentifyStartRes * identifyStartRes))completion;

- (void)identifyCheckWithSessionid:(NSInteger )sessionId rowId:(NSInteger )rowId completion:(void (^)(NSError *error, KBIdentifyCheckRes * identifyCheckRes))completion;

- (void)identifyWaitWithSessionid:(NSInteger )sessionId completion:(void (^)(NSError *error, KBIdentifyWaitRes * identifyWaitRes))completion;

- (void)identifyFinishWithSessionid:(NSInteger )sessionId doRemoteTrack:(BOOL )doRemoteTrack doLocalTrack:(BOOL )doLocalTrack status:(KBStatus *)status completion:(void (^)(NSError *error, KBStatus * status))completion;

@end
