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

@interface KBFOKID : KBRObject
@property NSData *pgpFingerprint;
@property NSData *kid;
@end

@interface KBProofStatus : KBRObject
@property NSInteger state;
@property NSInteger status;
@property NSString *desc;
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

@interface KBRIdentify : KBRRequest
- (void)identifySelfWithSessionid:(NSInteger )sessionId completion:(void (^)(NSError *error, KBStatus * status))completion;

@end

@interface KBCryptocurrency : KBRObject
@property NSInteger rowId;
@property NSData *pkhash;
@property NSString *address;
@end

@interface KBIdentity : KBRObject
@property KBStatus *status;
@property NSInteger whenLastTracked;
@property KBIdentifyKey *key;
@property NSArray *proofs;
@property NSArray *cryptocurrency;
@property NSArray *deleted;
@end

@interface KBSigHint : KBRObject
@property NSString *remoteId;
@property NSString *humanUrl;
@property NSString *apiUrl;
@property NSString *checkText;
@end

@interface KBCheckResult : KBRObject
@property KBProofStatus *proofStatus;
@property NSInteger timestamp;
@property NSString *displayMarkup;
@end

@interface KBLinkCheckResult : KBRObject
@property NSInteger proofId;
@property KBProofStatus *proofStatus;
@property KBCheckResult *cached;
@property KBTrackDiff *diff;
@property KBTrackDiff *remoteDiff;
@property KBSigHint *hint;
@end

@interface KBTrackSummary : KBRObject
@property NSInteger time;
@property BOOL isRemote;
@end

@interface KBIdentifyOutcome : KBRObject
@property KBStatus *status;
@property NSArray *warnings;
@property KBTrackSummary *trackUsed;
@property NSInteger numTrackFailures;
@property NSInteger numTrackChanges;
@property NSInteger numProofFailures;
@property NSInteger numDeleted;
@property NSInteger numProofSuccesses;
@property NSArray *deleted;
@end

@interface KBFinishAndPromptRes : KBRObject
@property KBStatus *status;
@property BOOL trackLocal;
@property BOOL trackRemote;
@end

@interface KBRIdentifyui : KBRRequest
- (void)finishAndPromptWithSessionid:(NSInteger )sessionId outcome:(KBIdentifyOutcome *)outcome completion:(void (^)(NSError *error, KBFinishAndPromptRes * finishAndPromptRes))completion;

- (void)finishWebProofCheckWithSessionid:(NSInteger )sessionId rp:(KBRemoteProof *)rp lcr:(KBLinkCheckResult *)lcr completion:(void (^)(NSError *error, KBStatus * status))completion;

- (void)finishSocialProofCheckWithSessionid:(NSInteger )sessionId rp:(KBRemoteProof *)rp lcr:(KBLinkCheckResult *)lcr completion:(void (^)(NSError *error, KBStatus * status))completion;

- (void)displayCryptocurrencyWithSessionid:(NSInteger )sessionId c:(KBCryptocurrency *)c completion:(void (^)(NSError *error, KBStatus * status))completion;

- (void)displayKeyWithSessionid:(NSInteger )sessionId fokid:(KBFOKID *)fokid diff:(KBTrackDiff *)diff completion:(void (^)(NSError *error, KBStatus * status))completion;

- (void)reportLastTrackWithSessionid:(NSInteger )sessionId track:(KBTrackSummary *)track completion:(void (^)(NSError *error, KBStatus * status))completion;

- (void)launchNetworkChecksWithSessionid:(NSInteger )sessionId id:(KBIdentity *)id completion:(void (^)(NSError *error, KBStatus * status))completion;

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

@interface KBGetEmailOrUsernameRes : KBRObject
@property KBStatus *status;
@property NSString *emailOrUsername;
@end

@interface KBGetKeybasePassphraseRes : KBRObject
@property KBStatus *status;
@property NSString *passphrase;
@end

@interface KBRLoginui : KBRRequest
- (void)getEmailOrUsername:(void (^)(NSError *error, KBGetEmailOrUsernameRes * getEmailOrUsernameRes))completion;

- (void)getKeybasePassphraseWithRetry:(NSString *)retry completion:(void (^)(NSError *error, KBGetKeybasePassphraseRes * getKeybasePassphraseRes))completion;

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
