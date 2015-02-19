#import "KBRObject.h"
#import "KBRRequest.h"
#import "KBRRequestParams.h"

@interface KBRStringKVPair : KBRObject
@property NSString *key;
@property NSString *value;
@end

@interface KBRStatus : KBRObject
@property NSInteger code;
@property NSString *name;
@property NSString *desc;
@property NSArray *fields; /*of KBRStringKVPair*/
@end

@interface KBRUID : NSData
@end

@interface KBRLoadUserArg : KBRObject
@property KBRUID *uid;
@property NSString *username;
@property BOOL self;
@end

@interface KBRFOKID : KBRObject
@property NSData *pgpFingerprint;
@property NSData *kid;
@end

@interface KBRText : KBRObject
@property NSString *data;
@property BOOL markup;
@end

@interface KBRPgpIdentity : KBRObject
@property NSString *username;
@property NSString *comment;
@property NSString *email;
@end

@interface KBRImage : KBRObject
@property NSString *url;
@property NSInteger width;
@property NSInteger height;
@end

@interface KBRUser : KBRObject
@property KBRUID *uid;
@property NSString *username;
@property KBRImage *image;
@end

@interface KBRSIGID : NSData
@end

@interface KBRBlockRequest : KBRRequest
- (void)announceSessionWithSid:(NSString *)sid completion:(void (^)(NSError *error))completion;

- (void)getWithBlockid:(NSData *)blockid uid:(KBRUID *)uid completion:(void (^)(NSError *error, NSData * bytes))completion;

- (void)deleteWithBlockid:(NSData *)blockid uid:(KBRUID *)uid completion:(void (^)(NSError *error))completion;

- (void)putWithBlockid:(NSData *)blockid uid:(KBRUID *)uid buf:(NSData *)buf completion:(void (^)(NSError *error))completion;

@end

@interface KBRCommonRequest : KBRRequest
@end

@interface KBRGetCurrentStatusRes : KBRObject
@property BOOL configured;
@property BOOL registered;
@property BOOL loggedIn;
@property KBRUser *user;
@property NSString *serverUri;
@end

@interface KBRConfigRequest : KBRRequest
- (void)getCurrentStatus:(void (^)(NSError *error, KBRGetCurrentStatusRes * getCurrentStatusRes))completion;

@end

typedef NS_ENUM (NSInteger, KBRDeviceSignerKind) {
	KBRDeviceSignerKindDevice,
	KBRDeviceSignerKindPgp,
};
typedef NS_ENUM (NSInteger, KBRSelectSignerAction) {
	KBRSelectSignerActionSign,
	KBRSelectSignerActionLogout,
	KBRSelectSignerActionResetAccount,
};
@interface KBRDeviceSigner : KBRObject
@property KBRDeviceSignerKind kind;
@property NSString *deviceID;
@end

@interface KBRSelectSignerRes : KBRObject
@property KBRSelectSignerAction action;
@property KBRDeviceSigner *signer;
@end

@interface KBRDevice : KBRObject
@property NSString *type;
@property NSString *name;
@property NSString *deviceID;
@end

@interface KBRDoctorUiRequest : KBRRequest
- (void)promptDeviceNameWithSessionId:(NSInteger )sessionId completion:(void (^)(NSError *error, NSString * str))completion;

- (void)selectSignerWithDevices:(NSArray *)devices hasPGP:(BOOL )hasPGP completion:(void (^)(NSError *error, KBRSelectSignerRes * selectSignerRes))completion;

- (void)displaySecretWordsWithSessionId:(NSInteger )sessionId secret:(NSString *)secret xDevDescription:(NSString *)xDevDescription completion:(void (^)(NSError *error))completion;

@end

@interface KBRGpgRequest : KBRRequest
- (void)addGpgKey:(void (^)(NSError *error))completion;

@end

@interface KBRGPGKey : KBRObject
@property NSString *algorithm;
@property NSString *keyID;
@property NSString *creation;
@property NSString *expiration;
@property NSArray *identities; /*of string*/
@end

@interface KBRSelectKeyRes : KBRObject
@property NSString *keyID;
@property BOOL doSecretPush;
@end

@interface KBRGpgUiRequest : KBRRequest
- (void)wantToAddGPGKey:(void (^)(NSError *error, BOOL  b))completion;

- (void)selectKeyAndPushOptionWithSessionId:(NSInteger )sessionId keys:(NSArray *)keys completion:(void (^)(NSError *error, KBRSelectKeyRes * selectKeyRes))completion;

- (void)selectKeyWithSessionId:(NSInteger )sessionId keys:(NSArray *)keys completion:(void (^)(NSError *error, NSString * str))completion;

@end

typedef NS_ENUM (NSInteger, KBRTrackDiffType) {
	KBRTrackDiffTypeNone,
	KBRTrackDiffTypeError,
	KBRTrackDiffTypeClash,
	KBRTrackDiffTypeDeleted,
	KBRTrackDiffTypeUpgraded,
	KBRTrackDiffTypeNew,
	KBRTrackDiffTypeRemoteFail,
	KBRTrackDiffTypeRemoteWorking,
	KBRTrackDiffTypeRemoteChanged,
};
@interface KBRTrackDiff : KBRObject
@property KBRTrackDiffType type;
@property NSString *displayMarkup;
@end

@interface KBRTrackSummary : KBRObject
@property NSInteger time;
@property BOOL isRemote;
@end

@interface KBRIdentifyOutcome : KBRObject
@property KBRStatus *status;
@property NSArray *warnings; /*of string*/
@property KBRTrackSummary *trackUsed;
@property NSInteger numTrackFailures;
@property NSInteger numTrackChanges;
@property NSInteger numProofFailures;
@property NSInteger numDeleted;
@property NSInteger numProofSuccesses;
@property NSArray *deleted; /*of KBRTrackDiff*/
@end

@interface KBRIdentifyRes : KBRObject
@property KBRUser *user;
@property KBRIdentifyOutcome *outcome;
@end

@interface KBRIdentifyRequest : KBRRequest
- (void)identifyWithUid:(KBRUID *)uid username:(NSString *)username trackStatement:(BOOL )trackStatement luba:(BOOL )luba loadSelf:(BOOL )loadSelf completion:(void (^)(NSError *error, KBRIdentifyRes * identifyRes))completion;

- (void)identifyDefaultWithUsername:(NSString *)username completion:(void (^)(NSError *error, KBRIdentifyRes * identifyRes))completion;

@end

@interface KBRProofStatus : KBRObject
@property NSInteger state;
@property NSInteger status;
@property NSString *desc;
@end

@interface KBRRemoteProof : KBRObject
@property NSInteger proofType;
@property NSString *key;
@property NSString *value;
@property NSString *displayMarkup;
@property KBRSIGID *sigId;
@property NSInteger mtime;
@end

@interface KBRIdentifyRow : KBRObject
@property NSInteger rowId;
@property KBRRemoteProof *proof;
@property KBRTrackDiff *trackDiff;
@end

@interface KBRIdentifyKey : KBRObject
@property NSData *pgpFingerprint;
@property NSData *KID;
@property KBRTrackDiff *trackDiff;
@end

@interface KBRCryptocurrency : KBRObject
@property NSInteger rowId;
@property NSData *pkhash;
@property NSString *address;
@end

@interface KBRIdentity : KBRObject
@property KBRStatus *status;
@property NSInteger whenLastTracked;
@property KBRIdentifyKey *key;
@property NSArray *proofs; /*of KBRIdentifyRow*/
@property NSArray *cryptocurrency; /*of KBRCryptocurrency*/
@property NSArray *deleted; /*of KBRTrackDiff*/
@end

@interface KBRSigHint : KBRObject
@property NSString *remoteId;
@property NSString *humanUrl;
@property NSString *apiUrl;
@property NSString *checkText;
@end

@interface KBRCheckResult : KBRObject
@property KBRProofStatus *proofStatus;
@property NSInteger timestamp;
@property NSString *displayMarkup;
@end

@interface KBRLinkCheckResult : KBRObject
@property NSInteger proofId;
@property KBRProofStatus *proofStatus;
@property KBRCheckResult *cached;
@property KBRTrackDiff *diff;
@property KBRTrackDiff *remoteDiff;
@property KBRSigHint *hint;
@end

@interface KBRFinishAndPromptRes : KBRObject
@property BOOL trackLocal;
@property BOOL trackRemote;
@end

@interface KBRIdentifyUiRequest : KBRRequest
- (void)finishAndPromptWithSessionId:(NSInteger )sessionId outcome:(KBRIdentifyOutcome *)outcome completion:(void (^)(NSError *error, KBRFinishAndPromptRes * finishAndPromptRes))completion;

- (void)finishWebProofCheckWithSessionId:(NSInteger )sessionId rp:(KBRRemoteProof *)rp lcr:(KBRLinkCheckResult *)lcr completion:(void (^)(NSError *error))completion;

- (void)finishSocialProofCheckWithSessionId:(NSInteger )sessionId rp:(KBRRemoteProof *)rp lcr:(KBRLinkCheckResult *)lcr completion:(void (^)(NSError *error))completion;

- (void)displayCryptocurrencyWithSessionId:(NSInteger )sessionId c:(KBRCryptocurrency *)c completion:(void (^)(NSError *error))completion;

- (void)displayKeyWithSessionId:(NSInteger )sessionId fokid:(KBRFOKID *)fokid diff:(KBRTrackDiff *)diff completion:(void (^)(NSError *error))completion;

- (void)reportLastTrackWithSessionId:(NSInteger )sessionId track:(KBRTrackSummary *)track completion:(void (^)(NSError *error))completion;

- (void)launchNetworkChecksWithSessionId:(NSInteger )sessionId id:(KBRIdentity *)id completion:(void (^)(NSError *error))completion;

- (void)displayTrackStatementWithSessionId:(NSInteger )sessionId stmt:(NSString *)stmt completion:(void (^)(NSError *error))completion;

@end

typedef NS_ENUM (NSInteger, KBRLogLevel) {
	KBRLogLevelNone,
	KBRLogLevelDebug,
	KBRLogLevelInfo,
	KBRLogLevelNotice,
	KBRLogLevelWarn,
	KBRLogLevelError,
	KBRLogLevelCritical,
};
@interface KBRLogUiRequest : KBRRequest
- (void)logWithSessionId:(NSInteger )sessionId level:(KBRLogLevel )level text:(KBRText *)text completion:(void (^)(NSError *error))completion;

@end

@interface KBRLoginRequest : KBRRequest
- (void)passphraseLoginWithIdentify:(BOOL )identify username:(NSString *)username passphrase:(NSString *)passphrase completion:(void (^)(NSError *error))completion;

- (void)pubkeyLogin:(void (^)(NSError *error))completion;

- (void)logout:(void (^)(NSError *error))completion;

- (void)switchUserWithUsername:(NSString *)username completion:(void (^)(NSError *error))completion;

@end

@interface KBRLoginUiRequest : KBRRequest
- (void)getEmailOrUsername:(void (^)(NSError *error, NSString * str))completion;

@end

@interface KBRPgpCreateUids : KBRObject
@property BOOL useDefault;
@property NSArray *ids; /*of KBRPgpIdentity*/
@end

@interface KBRMykeyRequest : KBRRequest
- (void)keyGenWithPrimaryBits:(NSInteger )primaryBits subkeyBits:(NSInteger )subkeyBits createUids:(KBRPgpCreateUids *)createUids noPassphrase:(BOOL )noPassphrase kbPassphrase:(BOOL )kbPassphrase noNaclEddsa:(BOOL )noNaclEddsa noNaclDh:(BOOL )noNaclDh pregen:(NSString *)pregen completion:(void (^)(NSError *error))completion;

- (void)keyGenDefaultWithCreateUids:(KBRPgpCreateUids *)createUids pushPublic:(BOOL )pushPublic pushSecret:(BOOL )pushSecret passphrase:(NSString *)passphrase completion:(void (^)(NSError *error))completion;

- (void)deletePrimary:(void (^)(NSError *error))completion;

- (void)show:(void (^)(NSError *error))completion;

- (void)selectWithQuery:(NSString *)query completion:(void (^)(NSError *error))completion;

@end

@interface KBRPushPreferences : KBRObject
@property BOOL public;
@property BOOL private;
@end

@interface KBRMykeyUiRequest : KBRRequest
- (void)getPushPreferences:(void (^)(NSError *error, KBRPushPreferences * pushPreferences))completion;

@end

@interface KBRProveRequest : KBRRequest
- (void)proveWithService:(NSString *)service username:(NSString *)username force:(BOOL )force completion:(void (^)(NSError *error))completion;

@end

typedef NS_ENUM (NSInteger, KBRPromptOverwriteType) {
	KBRPromptOverwriteTypeSocial,
	KBRPromptOverwriteTypeSite,
};
@interface KBRProveUiRequest : KBRRequest
- (void)promptOverwriteWithSessionId:(NSInteger )sessionId account:(NSString *)account typ:(KBRPromptOverwriteType )typ completion:(void (^)(NSError *error, BOOL  b))completion;

- (void)promptUsernameWithSessionId:(NSInteger )sessionId prompt:(NSString *)prompt prevError:(KBRStatus *)prevError completion:(void (^)(NSError *error, NSString * str))completion;

- (void)outputPrechecksWithSessionId:(NSInteger )sessionId text:(KBRText *)text completion:(void (^)(NSError *error))completion;

- (void)preProofWarningWithSessionId:(NSInteger )sessionId text:(KBRText *)text completion:(void (^)(NSError *error, BOOL  b))completion;

- (void)outputInstructionsWithSessionId:(NSInteger )sessionId instructions:(KBRText *)instructions proof:(NSString *)proof completion:(void (^)(NSError *error))completion;

- (void)okToCheckWithSessionId:(NSInteger )sessionId name:(NSString *)name attempt:(NSInteger )attempt completion:(void (^)(NSError *error, BOOL  b))completion;

- (void)displayRecheckWarningWithSessionId:(NSInteger )sessionId text:(KBRText *)text completion:(void (^)(NSError *error))completion;

@end

@interface KBRSessionToken : KBRObject
@property KBRUID *uid;
@property NSString *sid;
@property NSInteger generated;
@property NSInteger lifetime;
@end

@interface KBRQuotaRequest : KBRRequest
- (void)verifySessionWithSession:(NSString *)session completion:(void (^)(NSError *error, KBRSessionToken * sessionToken))completion;

@end

@interface KBRSecretEntryArg : KBRObject
@property NSString *desc;
@property NSString *prompt;
@property NSString *err;
@property NSString *cancel;
@property NSString *ok;
@end

@interface KBRSecretEntryRes : KBRObject
@property NSString *text;
@property BOOL canceled;
@end

@interface KBRSecretUiRequest : KBRRequest
- (void)getSecretWithPinentry:(KBRSecretEntryArg *)pinentry terminal:(KBRSecretEntryArg *)terminal completion:(void (^)(NSError *error, KBRSecretEntryRes * secretEntryRes))completion;

- (void)getNewPassphraseWithTerminalPrompt:(NSString *)terminalPrompt pinentryDesc:(NSString *)pinentryDesc pinentryPrompt:(NSString *)pinentryPrompt retryMessage:(NSString *)retryMessage completion:(void (^)(NSError *error, NSString * str))completion;

- (void)getKeybasePassphraseWithUsername:(NSString *)username retry:(NSString *)retry completion:(void (^)(NSError *error, NSString * str))completion;

@end

@interface KBRSession : KBRObject
@property KBRUID *uid;
@property NSString *username;
@end

@interface KBRSessionRequest : KBRRequest
- (void)currentSession:(void (^)(NSError *error, KBRSession * session))completion;

@end

@interface KBRSignupRes : KBRObject
@property BOOL passphraseOk;
@property BOOL postOk;
@property BOOL writeOk;
@end

@interface KBRSignupRequest : KBRRequest
- (void)checkUsernameAvailableWithUsername:(NSString *)username completion:(void (^)(NSError *error))completion;

- (void)signupWithEmail:(NSString *)email inviteCode:(NSString *)inviteCode passphrase:(NSString *)passphrase username:(NSString *)username deviceName:(NSString *)deviceName completion:(void (^)(NSError *error, KBRSignupRes * signupRes))completion;

- (void)inviteRequestWithEmail:(NSString *)email fullname:(NSString *)fullname notes:(NSString *)notes completion:(void (^)(NSError *error))completion;

@end

@interface KBRTrackRequest : KBRRequest
- (void)trackWithTheirName:(NSString *)theirName completion:(void (^)(NSError *error))completion;

@end

@interface KBRUiRequest : KBRRequest
- (void)promptYesNoWithText:(KBRText *)text def:(BOOL )def completion:(void (^)(NSError *error, BOOL  b))completion;

@end
@interface KBRAnnounceSessionRequestParams : KBRRequestParams
@property NSString *sid;
@end
@interface KBRGetRequestParams : KBRRequestParams
@property NSData *blockid;
@property KBRUID *uid;
@end
@interface KBRDeleteRequestParams : KBRRequestParams
@property NSData *blockid;
@property KBRUID *uid;
@end
@interface KBRPutRequestParams : KBRRequestParams
@property NSData *blockid;
@property KBRUID *uid;
@property NSData *buf;
@end
@interface KBRPromptDeviceNameRequestParams : KBRRequestParams
@property NSInteger sessionId;
@end
@interface KBRSelectSignerRequestParams : KBRRequestParams
@property NSArray *devices;
@property BOOL hasPGP;
@end
@interface KBRDisplaySecretWordsRequestParams : KBRRequestParams
@property NSInteger sessionId;
@property NSString *secret;
@property NSString *xDevDescription;
@end
@interface KBRSelectKeyAndPushOptionRequestParams : KBRRequestParams
@property NSInteger sessionId;
@property NSArray *keys;
@end
@interface KBRSelectKeyRequestParams : KBRRequestParams
@property NSInteger sessionId;
@property NSArray *keys;
@end
@interface KBRIdentifyRequestParams : KBRRequestParams
@property KBRUID *uid;
@property NSString *username;
@property BOOL trackStatement;
@property BOOL luba;
@property BOOL loadSelf;
@end
@interface KBRIdentifyDefaultRequestParams : KBRRequestParams
@property NSString *username;
@end
@interface KBRFinishAndPromptRequestParams : KBRRequestParams
@property NSInteger sessionId;
@property KBRIdentifyOutcome *outcome;
@end
@interface KBRFinishWebProofCheckRequestParams : KBRRequestParams
@property NSInteger sessionId;
@property KBRRemoteProof *rp;
@property KBRLinkCheckResult *lcr;
@end
@interface KBRFinishSocialProofCheckRequestParams : KBRRequestParams
@property NSInteger sessionId;
@property KBRRemoteProof *rp;
@property KBRLinkCheckResult *lcr;
@end
@interface KBRDisplayCryptocurrencyRequestParams : KBRRequestParams
@property NSInteger sessionId;
@property KBRCryptocurrency *c;
@end
@interface KBRDisplayKeyRequestParams : KBRRequestParams
@property NSInteger sessionId;
@property KBRFOKID *fokid;
@property KBRTrackDiff *diff;
@end
@interface KBRReportLastTrackRequestParams : KBRRequestParams
@property NSInteger sessionId;
@property KBRTrackSummary *track;
@end
@interface KBRLaunchNetworkChecksRequestParams : KBRRequestParams
@property NSInteger sessionId;
@property KBRIdentity *id;
@end
@interface KBRDisplayTrackStatementRequestParams : KBRRequestParams
@property NSInteger sessionId;
@property NSString *stmt;
@end
@interface KBRLogRequestParams : KBRRequestParams
@property NSInteger sessionId;
@property KBRLogLevel level;
@property KBRText *text;
@end
@interface KBRPassphraseLoginRequestParams : KBRRequestParams
@property BOOL identify;
@property NSString *username;
@property NSString *passphrase;
@end
@interface KBRSwitchUserRequestParams : KBRRequestParams
@property NSString *username;
@end
@interface KBRKeyGenRequestParams : KBRRequestParams
@property NSInteger primaryBits;
@property NSInteger subkeyBits;
@property KBRPgpCreateUids *createUids;
@property BOOL noPassphrase;
@property BOOL kbPassphrase;
@property BOOL noNaclEddsa;
@property BOOL noNaclDh;
@property NSString *pregen;
@end
@interface KBRKeyGenDefaultRequestParams : KBRRequestParams
@property KBRPgpCreateUids *createUids;
@property BOOL pushPublic;
@property BOOL pushSecret;
@property NSString *passphrase;
@end
@interface KBRSelectRequestParams : KBRRequestParams
@property NSString *query;
@end
@interface KBRProveRequestParams : KBRRequestParams
@property NSString *service;
@property NSString *username;
@property BOOL force;
@end
@interface KBRPromptOverwriteRequestParams : KBRRequestParams
@property NSInteger sessionId;
@property NSString *account;
@property KBRPromptOverwriteType typ;
@end
@interface KBRPromptUsernameRequestParams : KBRRequestParams
@property NSInteger sessionId;
@property NSString *prompt;
@property KBRStatus *prevError;
@end
@interface KBROutputPrechecksRequestParams : KBRRequestParams
@property NSInteger sessionId;
@property KBRText *text;
@end
@interface KBRPreProofWarningRequestParams : KBRRequestParams
@property NSInteger sessionId;
@property KBRText *text;
@end
@interface KBROutputInstructionsRequestParams : KBRRequestParams
@property NSInteger sessionId;
@property KBRText *instructions;
@property NSString *proof;
@end
@interface KBROkToCheckRequestParams : KBRRequestParams
@property NSInteger sessionId;
@property NSString *name;
@property NSInteger attempt;
@end
@interface KBRDisplayRecheckWarningRequestParams : KBRRequestParams
@property NSInteger sessionId;
@property KBRText *text;
@end
@interface KBRVerifySessionRequestParams : KBRRequestParams
@property NSString *session;
@end
@interface KBRGetSecretRequestParams : KBRRequestParams
@property KBRSecretEntryArg *pinentry;
@property KBRSecretEntryArg *terminal;
@end
@interface KBRGetNewPassphraseRequestParams : KBRRequestParams
@property NSString *terminalPrompt;
@property NSString *pinentryDesc;
@property NSString *pinentryPrompt;
@property NSString *retryMessage;
@end
@interface KBRGetKeybasePassphraseRequestParams : KBRRequestParams
@property NSString *username;
@property NSString *retry;
@end
@interface KBRCheckUsernameAvailableRequestParams : KBRRequestParams
@property NSString *username;
@end
@interface KBRSignupRequestParams : KBRRequestParams
@property NSString *email;
@property NSString *inviteCode;
@property NSString *passphrase;
@property NSString *username;
@property NSString *deviceName;
@end
@interface KBRInviteRequestRequestParams : KBRRequestParams
@property NSString *email;
@property NSString *fullname;
@property NSString *notes;
@end
@interface KBRTrackRequestParams : KBRRequestParams
@property NSString *theirName;
@end
@interface KBRPromptYesNoRequestParams : KBRRequestParams
@property KBRText *text;
@property BOOL def;
@end