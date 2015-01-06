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

@interface KBLoadUserArg : KBRObject
@property KBUID *uid;
@property NSString *username;
@property BOOL self;
@end

@interface KBFOKID : KBRObject
@property NSData *pgpFingerprint;
@property NSData *kid;
@end

@interface KBText : KBRObject
@property NSString *data;
@property BOOL markup;
@end

@interface KBGetCurrentStatusRes : KBRObject
@property BOOL configured;
@property BOOL registered;
@property BOOL loggedIn;
@property BOOL publicKeySelected;
@property BOOL hasPrivateKey;
@end

@interface KBRConfig : KBRRequest
- (void)getCurrentStatus:(void (^)(NSError *error, KBGetCurrentStatusRes * getCurrentStatusRes))completion;

@end

@interface KBRIdentify : KBRRequest
@end

typedef NS_ENUM (NSInteger, KBTrackDiffType) {
	KBTrackDiffTypeNone, 
	KBTrackDiffTypeError, 
	KBTrackDiffTypeClash, 
	KBTrackDiffTypeDeleted, 
	KBTrackDiffTypeUpgraded, 
	KBTrackDiffTypeNew, 
	KBTrackDiffTypeRemote_fail, 
	KBTrackDiffTypeRemote_working, 
	KBTrackDiffTypeRemote_changed, 
};
@interface KBTrackDiff : KBRObject
@property KBTrackDiffType type;
@property NSString *displayMarkup;
@end

@interface KBProofStatus : KBRObject
@property NSInteger state;
@property NSInteger status;
@property NSString *desc;
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
@property BOOL trackLocal;
@property BOOL trackRemote;
@end

@interface KBRIdentifyUi : KBRRequest
- (void)finishAndPromptWithSessionId:(NSInteger )sessionId outcome:(KBIdentifyOutcome *)outcome completion:(void (^)(NSError *error, KBFinishAndPromptRes * finishAndPromptRes))completion;

- (void)finishWebProofCheckWithSessionId:(NSInteger )sessionId rp:(KBRemoteProof *)rp lcr:(KBLinkCheckResult *)lcr completion:(void (^)(NSError *error))completion;

- (void)finishSocialProofCheckWithSessionId:(NSInteger )sessionId rp:(KBRemoteProof *)rp lcr:(KBLinkCheckResult *)lcr completion:(void (^)(NSError *error))completion;

- (void)displayCryptocurrencyWithSessionId:(NSInteger )sessionId c:(KBCryptocurrency *)c completion:(void (^)(NSError *error))completion;

- (void)displayKeyWithSessionId:(NSInteger )sessionId fokid:(KBFOKID *)fokid diff:(KBTrackDiff *)diff completion:(void (^)(NSError *error))completion;

- (void)reportLastTrackWithSessionId:(NSInteger )sessionId track:(KBTrackSummary *)track completion:(void (^)(NSError *error))completion;

- (void)launchNetworkChecksWithSessionId:(NSInteger )sessionId id:(KBIdentity *)id completion:(void (^)(NSError *error))completion;

- (void)warningWithSessionId:(NSInteger )sessionId msg:(NSString *)msg completion:(void (^)(NSError *error))completion;

@end

typedef NS_ENUM (NSInteger, KBLogLevel) {
	KBLogLevelNone, 
	KBLogLevelDebug, 
	KBLogLevelInfo, 
	KBLogLevelWarn, 
	KBLogLevelError, 
	KBLogLevelCritical, 
};
@interface KBRLog : KBRRequest
- (void)logWithLevel:(KBLogLevel )level text:(KBText *)text completion:(void (^)(NSError *error))completion;

@end

@interface KBRLogin : KBRRequest
- (void)passphraseLoginWithIdentify:(BOOL )identify completion:(void (^)(NSError *error))completion;

- (void)pubkeyLogin:(void (^)(NSError *error))completion;

- (void)logout:(void (^)(NSError *error))completion;

- (void)switchUserWithUsername:(NSString *)username completion:(void (^)(NSError *error))completion;

@end

@interface KBRLoginUi : KBRRequest
- (void)getEmailOrUsername:(void (^)(NSError *error, NSString * str))completion;

- (void)getKeybasePassphraseWithUsername:(NSString *)username retry:(NSString *)retry completion:(void (^)(NSError *error, NSString * str))completion;

@end

@interface KBRProve : KBRRequest
- (void)proveWithService:(NSString *)service username:(NSString *)username force:(BOOL )force completion:(void (^)(NSError *error))completion;

@end

@interface KBRProveUi : KBRRequest
- (void)promptOverwrite1WithSessionId:(NSInteger )sessionId account:(NSString *)account completion:(void (^)(NSError *error, BOOL  b))completion;

- (void)promptOverwrite2WithSessionId:(NSInteger )sessionId service:(NSString *)service completion:(void (^)(NSError *error, BOOL  b))completion;

- (void)promptUsernameWithSessionId:(NSInteger )sessionId prompt:(NSString *)prompt prevError:(KBStatus *)prevError completion:(void (^)(NSError *error, NSString * str))completion;

- (void)outputPrechecksWithSessionId:(NSInteger )sessionId text:(KBText *)text completion:(void (^)(NSError *error))completion;

- (void)preProofWarningWithSessionId:(NSInteger )sessionId text:(KBText *)text completion:(void (^)(NSError *error, BOOL  b))completion;

- (void)outputInstructionsWithSessionId:(NSInteger )sessionId instructions:(KBText *)instructions proof:(NSString *)proof completion:(void (^)(NSError *error))completion;

- (void)okToCheckWithSessionId:(NSInteger )sessionId name:(NSString *)name attempt:(NSInteger )attempt completion:(void (^)(NSError *error, BOOL  b))completion;

- (void)displayRecheckWarningWithSessionId:(NSInteger )sessionId text:(KBText *)text completion:(void (^)(NSError *error))completion;

@end

@interface KBSignupRes : KBRObject
@property BOOL passphraseOk;
@property BOOL postOk;
@property BOOL writeOk;
@end

@interface KBRSignup : KBRRequest
- (void)checkUsernameAvailableWithUsername:(NSString *)username completion:(void (^)(NSError *error))completion;

- (void)signupWithEmail:(NSString *)email inviteCode:(NSString *)inviteCode passphrase:(NSString *)passphrase username:(NSString *)username completion:(void (^)(NSError *error, KBSignupRes * signupRes))completion;

- (void)inviteRequestWithEmail:(NSString *)email fullname:(NSString *)fullname notes:(NSString *)notes completion:(void (^)(NSError *error))completion;

@end

@interface KBRUi : KBRRequest
- (void)promptYesNoWithText:(KBText *)text def:(BOOL )def completion:(void (^)(NSError *error, BOOL  b))completion;

@end
