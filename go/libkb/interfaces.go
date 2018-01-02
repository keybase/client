// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

/*
 * Interfaces
 *
 *   Here are the interfaces that we're going to assume when
 *   implementing the features of command-line clients or
 *   servers.  Depending on the context, we might get different
 *   instantiations of these interfaces.
 */

import (
	"io"
	"net/http"
	"time"

	"golang.org/x/net/context"

	"github.com/PuerkitoBio/goquery"
	gregor "github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	clockwork "github.com/keybase/clockwork"
	jsonw "github.com/keybase/go-jsonw"
)

type configGetter interface {
	GetAPITimeout() (time.Duration, bool)
	GetAppType() AppType
	GetAutoFork() (bool, bool)
	GetChatDbFilename() string
	GetPvlKitFilename() string
	GetCodeSigningKIDs() []string
	GetConfigFilename() string
	GetDbFilename() string
	GetDebug() (bool, bool)
	GetUpgradePerUserKey() (bool, bool)
	GetGpg() string
	GetGpgHome() string
	GetGpgOptions() []string
	GetGregorDisabled() (bool, bool)
	GetBGIdentifierDisabled() (bool, bool)
	GetGregorPingInterval() (time.Duration, bool)
	GetGregorPingTimeout() (time.Duration, bool)
	GetGregorSaveInterval() (time.Duration, bool)
	GetGregorURI() string
	GetHome() string
	GetLinkCacheSize() (int, bool)
	GetLocalRPCDebug() string
	GetLocalTrackMaxAge() (time.Duration, bool)
	GetLogFile() string
	GetLogFormat() string
	GetMerkleKIDs() []string
	GetMountDir() string
	GetPidFile() string
	GetPinentry() string
	GetProofCacheSize() (int, bool)
	GetProxy() string
	GetRunMode() (RunMode, error)
	GetScraperTimeout() (time.Duration, bool)
	GetSecretKeyringTemplate() string
	GetServerURI() string
	GetSessionFilename() string
	GetSocketFile() string
	GetStandalone() (bool, bool)
	GetTimers() string
	GetTorHiddenAddress() string
	GetTorMode() (TorMode, error)
	GetTorProxy() string
	GetUPAKCacheSize() (int, bool)
	GetUIDMapFullNameCacheSize() (int, bool)
	GetUpdaterConfigFilename() string
	GetUserCacheMaxAge() (time.Duration, bool)
	GetVDebugSetting() string
	GetChatDelivererInterval() (time.Duration, bool)
	GetFeatureFlags() (FeatureFlags, error)
	GetLevelDBNumFiles() (int, bool)
	GetChatInboxSourceLocalizeThreads() (int, bool)
}

type CommandLine interface {
	configGetter

	GetAPIDump() (bool, bool)
	GetPGPFingerprint() *PGPFingerprint
	GetNoAutoFork() (bool, bool)

	// Lower-level functions
	GetGString(string) string
	GetString(string) string
	GetBool(string, bool) (bool, bool)
}

type Server interface {
}

type ObjType byte

type DbKey struct {
	Typ ObjType
	Key string
}

type LocalDbOps interface {
	Put(id DbKey, aliases []DbKey, value []byte) error
	Delete(id DbKey) error
	Get(id DbKey) ([]byte, bool, error)
	Lookup(alias DbKey) ([]byte, bool, error)
}

type LocalDbTransaction interface {
	LocalDbOps
	Commit() error
	Discard()
}

type LocalDb interface {
	LocalDbOps
	Open() error
	ForceOpen() error
	Close() error
	Nuke() (string, error)
	OpenTransaction() (LocalDbTransaction, error)
}

type KVStorer interface {
	GetInto(obj interface{}, id DbKey) (found bool, err error)
	PutObj(id DbKey, aliases []DbKey, obj interface{}) (err error)
	Delete(id DbKey) error
}

type ConfigReader interface {
	configGetter

	GetUserConfig() (*UserConfig, error)
	GetUserConfigForUsername(s NormalizedUsername) (*UserConfig, error)
	GetBundledCA(host string) string
	GetStringAtPath(string) (string, bool)
	GetInterfaceAtPath(string) (interface{}, error)
	GetBoolAtPath(string) (bool, bool)
	GetIntAtPath(string) (int, bool)
	GetNullAtPath(string) bool
	GetProofCacheLongDur() (time.Duration, bool)
	GetProofCacheMediumDur() (time.Duration, bool)
	GetProofCacheShortDur() (time.Duration, bool)
	GetLinkCacheCleanDur() (time.Duration, bool)
	GetNoPinentry() (bool, bool)
	GetSalt() []byte
	GetDeviceID() keybase1.DeviceID
	GetDeviceIDForUsername(nu NormalizedUsername) keybase1.DeviceID
	GetDeviceIDForUID(u keybase1.UID) keybase1.DeviceID
	GetUsername() NormalizedUsername
	GetAllUsernames() (current NormalizedUsername, others []NormalizedUsername, err error)
	GetUID() keybase1.UID
	GetProxyCACerts() ([]string, error)
	GetSecurityAccessGroupOverride() (bool, bool)
	GetBug3964RepairTime(NormalizedUsername) (time.Time, error)

	GetUpdatePreferenceAuto() (bool, bool)
	GetUpdatePreferenceSkip() string
	GetUpdatePreferenceSnoozeUntil() keybase1.Time
	GetUpdateLastChecked() keybase1.Time
	GetUpdateURL() string
	GetUpdateDisabled() (bool, bool)
	IsAdmin() (bool, bool)
}

type UpdaterConfigReader interface {
	GetInstallID() InstallID
}

type ConfigWriterTransacter interface {
	Commit() error
	Abort() error
}

type ConfigWriter interface {
	SetUserConfig(cfg *UserConfig, overwrite bool) error
	SwitchUser(un NormalizedUsername) error
	NukeUser(un NormalizedUsername) error
	SetDeviceID(keybase1.DeviceID) error
	SetStringAtPath(string, string) error
	SetBoolAtPath(string, bool) error
	SetIntAtPath(string, int) error
	SetWrapperAtPath(string, *jsonw.Wrapper) error
	SetNullAtPath(string) error
	DeleteAtPath(string)
	SetUpdatePreferenceAuto(bool) error
	SetUpdatePreferenceSkip(string) error
	SetUpdatePreferenceSnoozeUntil(keybase1.Time) error
	SetUpdateLastChecked(keybase1.Time) error
	SetBug3964RepairTime(NormalizedUsername, time.Time) error
	Reset()
	BeginTransaction() (ConfigWriterTransacter, error)
}

type HTTPRequest interface {
	SetEnvironment(env Env)
}

type Usage struct {
	Config     bool
	GpgKeyring bool
	KbKeyring  bool
	API        bool
	Socket     bool
}

type Command interface {
	GetUsage() Usage
}

type JSONPayload map[string]interface{}

type APIRes struct {
	Status     *jsonw.Wrapper
	Body       *jsonw.Wrapper
	HTTPStatus int
	AppStatus  *AppStatus
}

type AppStatus struct {
	Code   int               `json:"code"`
	Name   string            `json:"name"`
	Desc   string            `json:"desc"`
	Fields map[string]string `json:"fields"`
}

type APIResponseWrapper interface {
	GetAppStatus() *AppStatus
}

type ExternalHTMLRes struct {
	HTTPStatus int
	GoQuery    *goquery.Document
}

type ExternalTextRes struct {
	HTTPStatus int
	Body       string
}

type ExternalAPIRes struct {
	HTTPStatus int
	Body       *jsonw.Wrapper
}

type API interface {
	Get(APIArg) (*APIRes, error)
	GetResp(APIArg) (*http.Response, func(), error)
	GetDecode(APIArg, APIResponseWrapper) error
	Post(APIArg) (*APIRes, error)
	PostJSON(APIArg) (*APIRes, error)
	PostDecode(APIArg, APIResponseWrapper) error
	PostRaw(APIArg, string, io.Reader) (*APIRes, error)
	Delete(APIArg) (*APIRes, error)
}

type ExternalAPI interface {
	Get(APIArg) (*ExternalAPIRes, error)
	Post(APIArg) (*ExternalAPIRes, error)
	GetHTML(APIArg) (*ExternalHTMLRes, error)
	GetText(APIArg) (*ExternalTextRes, error)
	PostHTML(APIArg) (*ExternalHTMLRes, error)
}

type IdentifyUI interface {
	Start(string, keybase1.IdentifyReason, bool) error
	FinishWebProofCheck(keybase1.RemoteProof, keybase1.LinkCheckResult) error
	FinishSocialProofCheck(keybase1.RemoteProof, keybase1.LinkCheckResult) error
	Confirm(*keybase1.IdentifyOutcome) (keybase1.ConfirmResult, error)
	DisplayCryptocurrency(keybase1.Cryptocurrency) error
	DisplayKey(keybase1.IdentifyKey) error
	ReportLastTrack(*keybase1.TrackSummary) error
	LaunchNetworkChecks(*keybase1.Identity, *keybase1.User) error
	DisplayTrackStatement(string) error
	DisplayUserCard(keybase1.UserCard) error
	ReportTrackToken(keybase1.TrackToken) error
	Cancel() error
	Finish() error
	DisplayTLFCreateWithInvite(keybase1.DisplayTLFCreateWithInviteArg) error
	Dismiss(string, keybase1.DismissReason) error
}

type Checker struct {
	F             func(string) bool
	Hint          string
	PreserveSpace bool
}

type PromptArg struct {
	TerminalPrompt string
	PinentryDesc   string
	PinentryPrompt string
	Checker        *Checker
	RetryMessage   string
	UseSecretStore bool
	ShowTyping     bool
}

type LoginUI interface {
	keybase1.LoginUiInterface
}

type ProveUI interface {
	PromptOverwrite(context.Context, keybase1.PromptOverwriteArg) (bool, error)
	PromptUsername(context.Context, keybase1.PromptUsernameArg) (string, error)
	OutputPrechecks(context.Context, keybase1.OutputPrechecksArg) error
	PreProofWarning(context.Context, keybase1.PreProofWarningArg) (bool, error)
	OutputInstructions(context.Context, keybase1.OutputInstructionsArg) error
	OkToCheck(context.Context, keybase1.OkToCheckArg) (bool, error)
	DisplayRecheckWarning(context.Context, keybase1.DisplayRecheckWarningArg) error
}

type SecretUI interface {
	GetPassphrase(pinentry keybase1.GUIEntryArg, terminal *keybase1.SecretEntryArg) (keybase1.GetPassphraseRes, error)
}

type SaltpackUI interface {
	SaltpackPromptForDecrypt(context.Context, keybase1.SaltpackPromptForDecryptArg, bool) error
	SaltpackVerifySuccess(context.Context, keybase1.SaltpackVerifySuccessArg) error
	SaltpackVerifyBadSender(context.Context, keybase1.SaltpackVerifyBadSenderArg) error
}

type LogUI interface {
	Debug(format string, args ...interface{})
	Info(format string, args ...interface{})
	Warning(format string, args ...interface{})
	Notice(format string, args ...interface{})
	Errorf(format string, args ...interface{})
	Critical(format string, args ...interface{})
}

type LogFunc func(format string, args ...interface{})

type GPGUI interface {
	keybase1.GpgUiInterface
}

type PgpUI interface {
	keybase1.PGPUiInterface
}

type ProvisionUI interface {
	keybase1.ProvisionUiInterface
}

type ChatUI interface {
	ChatAttachmentUploadOutboxID(context.Context, chat1.ChatAttachmentUploadOutboxIDArg) error
	ChatAttachmentUploadStart(context.Context, chat1.AssetMetadata, chat1.MessageID) error
	ChatAttachmentUploadProgress(context.Context, chat1.ChatAttachmentUploadProgressArg) error
	ChatAttachmentUploadDone(context.Context) error
	ChatAttachmentPreviewUploadStart(context.Context, chat1.AssetMetadata) error
	ChatAttachmentPreviewUploadDone(context.Context) error
	ChatAttachmentDownloadStart(context.Context) error
	ChatAttachmentDownloadProgress(context.Context, chat1.ChatAttachmentDownloadProgressArg) error
	ChatAttachmentDownloadDone(context.Context) error
	ChatInboxUnverified(context.Context, chat1.ChatInboxUnverifiedArg) error
	ChatInboxConversation(context.Context, chat1.ChatInboxConversationArg) error
	ChatInboxFailed(context.Context, chat1.ChatInboxFailedArg) error
	ChatThreadCached(context.Context, chat1.ChatThreadCachedArg) error
	ChatThreadFull(context.Context, chat1.ChatThreadFullArg) error
	ChatConfirmChannelDelete(context.Context, chat1.ChatConfirmChannelDeleteArg) (bool, error)
}

type PromptDefault int

const (
	PromptDefaultNo PromptDefault = iota
	PromptDefaultYes
	PromptDefaultNeither
)

type PromptDescriptor int
type OutputDescriptor int

type TerminalUI interface {
	ErrorWriter() io.Writer
	Output(string) error
	OutputDesc(OutputDescriptor, string) error
	OutputWriter() io.Writer
	Printf(fmt string, args ...interface{}) (int, error)
	Prompt(PromptDescriptor, string) (string, error)
	PromptForConfirmation(prompt string) error
	PromptPassword(PromptDescriptor, string) (string, error)
	PromptYesNo(PromptDescriptor, string, PromptDefault) (bool, error)
	Tablify(headings []string, rowfunc func() []string)
	TerminalSize() (width int, height int)
}

type DumbOutputUI interface {
	Printf(fmt string, args ...interface{}) (int, error)
	PrintfStderr(fmt string, args ...interface{}) (int, error)
}

type UI interface {
	GetIdentifyUI() IdentifyUI
	GetIdentifyTrackUI() IdentifyUI
	GetLoginUI() LoginUI
	GetSecretUI() SecretUI
	GetTerminalUI() TerminalUI
	GetDumbOutputUI() DumbOutputUI
	GetProveUI() ProveUI
	GetLogUI() LogUI
	GetGPGUI() GPGUI
	GetProvisionUI(role KexRole) ProvisionUI
	GetPgpUI() PgpUI
	Configure() error
	Shutdown() error
}

type UIRouter interface {
	SetUI(ConnectionID, UIKind)

	// These are allowed to return nil for the UI even if
	// error is nil.
	GetIdentifyUI() (IdentifyUI, error)
	GetIdentifyUICtx(ctx context.Context) (int, IdentifyUI, error)
	GetSecretUI(sessionID int) (SecretUI, error)
	GetRekeyUI() (keybase1.RekeyUIInterface, int, error)
	GetRekeyUINoSessionID() (keybase1.RekeyUIInterface, error)

	Shutdown()
}

type UIConsumer interface {
	Name() string
	RequiredUIs() []UIKind
	SubConsumers() []UIConsumer
}

type Triplesec interface {
	DeriveKey(l int) ([]byte, []byte, error)
	Decrypt([]byte) ([]byte, error)
	Encrypt([]byte) ([]byte, error)
	Scrub()
}

type Clock interface {
	Now() time.Time
}

type GregorDismisser interface {
	DismissItem(ctx context.Context, cli gregor1.IncomingInterface, id gregor.MsgID) error
	LocalDismissItem(ctx context.Context, id gregor.MsgID) error
}

type GregorInBandMessageHandler interface {
	IsAlive() bool
	Name() string
	Create(ctx context.Context, cli gregor1.IncomingInterface, category string, ibm gregor.Item) (bool, error)
	Dismiss(ctx context.Context, cli gregor1.IncomingInterface, category string, ibm gregor.Item) (bool, error)
}

type GregorFirehoseHandler interface {
	IsAlive() bool
	PushState(gregor1.State, keybase1.PushReason)
	PushOutOfBandMessages([]gregor1.OutOfBandMessage)
}

type GregorListener interface {
	PushHandler(handler GregorInBandMessageHandler)
	PushFirehoseHandler(handler GregorFirehoseHandler)
}

type LogContext interface {
	GetLog() logger.Logger
}

type VLogContext interface {
	LogContext
	GetVDebugLog() *VDebugLog
}

// APIContext defines methods for accessing API server
type APIContext interface {
	GetAPI() API
	GetExternalAPI() ExternalAPI
	GetServerURI() string
}

type NetContext interface {
	GetNetContext() context.Context
}

type DNSNameServerFetcher interface {
	GetServers() []string
}

type DNSContext interface {
	GetDNSNameServerFetcher() DNSNameServerFetcher
}

// ProofContext defines features needed by the proof system
type ProofContext interface {
	LogContext
	APIContext
	NetContext
	DNSContext
	GetPvlSource() PvlSource
	GetAppType() AppType
}

type AssertionContext interface {
	NormalizeSocialName(service string, username string) (string, error)
}

// ProofChecker is an interface for performing a remote check for a proof

type ProofCheckerMode int

const (
	ProofCheckerModePassive ProofCheckerMode = iota
	ProofCheckerModeActive  ProofCheckerMode = iota
)

type ProofChecker interface {
	CheckStatus(ctx ProofContext, h SigHint, pcm ProofCheckerMode, pvlU PvlUnparsed) ProofError
	GetTorError() ProofError
}

// ServiceType is an interface for describing an external proof service, like 'Twitter'
// or 'GitHub', etc.
type ServiceType interface {
	AllStringKeys() []string

	// NormalizeUsername normalizes the given username, assuming
	// that it's free of any leading strings like '@' or 'dns://'.
	NormalizeUsername(string) (string, error)

	// NormalizeRemote normalizes the given remote username, which
	// is usually but not always the same as the username. It also
	// allows leaders like '@' and 'dns://'.
	//
	// In the case of Facebook, this version does the standard downcasing, but
	// leaves the dots in (that NormalizeUsername above would strip out). This
	// lets us keep the dots in the proof text, and display them on your
	// profile page, even though we ignore them for proof checking.
	NormalizeRemoteName(ctx ProofContext, name string) (string, error)

	GetPrompt() string
	LastWriterWins() bool
	PreProofCheck(ctx ProofContext, remotename string) (*Markup, error)
	PreProofWarning(remotename string) *Markup
	ToServiceJSON(remotename string) *jsonw.Wrapper
	PostInstructions(remotename string) *Markup
	DisplayName(remotename string) string
	RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, remotename string) (warning *Markup, err error)
	GetProofType() string
	GetTypeName() string
	CheckProofText(text string, id keybase1.SigID, sig string) error
	FormatProofText(ProofContext, *PostProofRes) (string, error)
	GetAPIArgKey() string
	IsDevelOnly() bool

	MakeProofChecker(l RemoteProofChainLink) ProofChecker
}

type ExternalServicesCollector interface {
	GetServiceType(n string) ServiceType
	ListProofCheckers(mode RunMode) []string
}

type PvlSource interface {
	GetPVL(ctx context.Context) (PvlUnparsed, error)
}

// UserChangedHandler is a generic interface for handling user changed events.
// If the call returns an error, we'll remove this handler from the list, under the
// supposition that it's now dead.
type UserChangedHandler interface {
	// HandlerUserChanged is called when the with User with the given UID has
	// changed, either because of a sigchain change, or a profile change.
	HandleUserChanged(uid keybase1.UID) error
}

type ConnectivityMonitorResult int

const (
	ConnectivityMonitorYes ConnectivityMonitorResult = iota
	ConnectivityMonitorNo
	ConnectivityMonitorUnknown
)

type ConnectivityMonitor interface {
	IsConnected(ctx context.Context) ConnectivityMonitorResult
	CheckReachability(ctx context.Context) error
}

type TeamLoader interface {
	VerifyTeamName(ctx context.Context, id keybase1.TeamID, name keybase1.TeamName) error
	ImplicitAdmins(ctx context.Context, teamID keybase1.TeamID) (impAdmins []keybase1.UserVersion, err error)
	MapIDToName(ctx context.Context, id keybase1.TeamID) (keybase1.TeamName, error)
	NotifyTeamRename(ctx context.Context, id keybase1.TeamID, newName string) error
	Load(context.Context, keybase1.LoadTeamArg) (*keybase1.TeamData, error)
	// Delete the cache entry. Does not error if there is no cache entry.
	Delete(ctx context.Context, teamID keybase1.TeamID) error
	// Untrusted hint of what a team's latest seqno is
	HintLatestSeqno(ctx context.Context, id keybase1.TeamID, seqno keybase1.Seqno) error
	OnLogout()
	// Clear the in-memory cache. Does not affect the disk cache.
	ClearMem()
}

type ImplicitTeamConflictInfoCacher interface {
	Get(context.Context, bool, keybase1.TeamID) *keybase1.ImplicitTeamConflictInfo
	Put(context.Context, bool, keybase1.TeamID, keybase1.ImplicitTeamConflictInfo) error
}

type KVStoreContext interface {
	GetKVStore() KVStorer
}

type LRUContext interface {
	VLogContext
	KVStoreContext
	ClockContext
}

type LRUKeyer interface {
	MemKey() string
	DbKey() DbKey
}

type LRUer interface {
	Get(context.Context, LRUContext, LRUKeyer) (interface{}, error)
	Put(context.Context, LRUContext, LRUKeyer, interface{}) error
}

type ClockContext interface {
	GetClock() clockwork.Clock
}

type UIDMapperContext interface {
	VLogContext
	APIContext
	KVStoreContext
	ClockContext
}

type UsernamePackage struct {
	NormalizedUsername NormalizedUsername
	FullName           *keybase1.FullNamePackage
}

type SkinnyLogger interface {
	// Error logs a message at error level, with formatting args
	Errorf(format string, args ...interface{})
	// Debug logs a message at debug level, with formatting args.
	Debug(format string, args ...interface{})
}

type UIDMapper interface {
	// CheckUIDAginstUsername makes sure that the UID actually does map to the given username.
	// For new UIDs, it's a question of just SHA2'ing. For legacy usernames, we check the
	// hardcoded map.
	CheckUIDAgainstUsername(uid keybase1.UID, un NormalizedUsername) bool

	// MapUIDToUsernamePackages maps the given set of UIDs to the username packages, which include
	// a username and a fullname, and when the mapping was loaded from the server. It blocks
	// on the network until all usernames are known. If the `forceNetworkForFullNames` flag is specified,
	// it will block on the network too. If the flag is not specified, then stale values (or unknown values)
	// are OK, we won't go to network if we lack them. All network calls are limited by the given timeBudget,
	// or if 0 is specified, there is indefinite budget. In the response, a nil FullNamePackage means that the
	// lookup failed. A non-nil FullNamePackage means that some previous lookup worked, but
	// might be arbitrarily out of date (depending on the cachedAt time). A non-nil FullNamePackage
	// with an empty fullName field means that the user just hasn't supplied a fullName.
	//
	// *NOTE* that this function can return useful data and an error. In this regard, the error is more
	// like a warning. But if, for instance, the mapper runs out of time budget, it will return the data
	MapUIDsToUsernamePackages(ctx context.Context, g UIDMapperContext, uids []keybase1.UID, fullNameFreshness time.Duration, networktimeBudget time.Duration, forceNetworkForFullNames bool) ([]UsernamePackage, error)

	// SetTestingNoCachingMode puts the UID mapper into a mode where it never serves cached results, *strictly
	// for use in tests*
	SetTestingNoCachingMode(enabled bool)

	// ClearUID is called to clear the given UID out of the cache, if the given eldest
	// seqno doesn't match what's currently cached.
	ClearUIDAtEldestSeqno(context.Context, UIDMapperContext, keybase1.UID, keybase1.Seqno) error

	// InformOfEldestSeqno informs the mapper of an up-to-date (uid,eldestSeqno) pair.
	// If the cache has a different value, it will clear the cache and then plumb
	// the pair all the way through to the server, whose cache may also be in need
	// of busting. Will return true if the cached value was up-to-date, and false
	// otherwise.
	InformOfEldestSeqno(context.Context, UIDMapperContext, keybase1.UserVersion) (bool, error)
}

type ChatHelper interface {
	SendTextByID(ctx context.Context, convID chat1.ConversationID,
		trip chat1.ConversationIDTriple, tlfName string, text string) error
	SendMsgByID(ctx context.Context, convID chat1.ConversationID,
		trip chat1.ConversationIDTriple, tlfName string, body chat1.MessageBody, msgType chat1.MessageType) error
	SendTextByIDNonblock(ctx context.Context, convID chat1.ConversationID,
		trip chat1.ConversationIDTriple, tlfName string, text string) error
	SendMsgByIDNonblock(ctx context.Context, convID chat1.ConversationID,
		trip chat1.ConversationIDTriple, tlfName string, body chat1.MessageBody, msgType chat1.MessageType) error
	SendTextByName(ctx context.Context, name string, topicName *string,
		membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, text string) error
	SendMsgByName(ctx context.Context, name string, topicName *string,
		membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, body chat1.MessageBody,
		msgType chat1.MessageType) error
	SendTextByNameNonblock(ctx context.Context, name string, topicName *string,
		membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, text string) error
	SendMsgByNameNonblock(ctx context.Context, name string, topicName *string,
		membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, body chat1.MessageBody,
		msgType chat1.MessageType) error
}
