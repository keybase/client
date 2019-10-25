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
	stellar1 "github.com/keybase/client/go/protocol/stellar1"
	clockwork "github.com/keybase/clockwork"
	jsonw "github.com/keybase/go-jsonw"
)

type configGetter interface {
	GetAPITimeout() (time.Duration, bool)
	GetAppType() AppType
	IsMobileExtension() (bool, bool)
	GetSlowGregorConn() (bool, bool)
	GetReadDeletedSigChain() (bool, bool)
	GetAutoFork() (bool, bool)
	GetChatDbFilename() string
	GetPvlKitFilename() string
	GetParamProofKitFilename() string
	GetExternalURLKitFilename() string
	GetProveBypass() (bool, bool)
	GetCodeSigningKIDs() []string
	GetConfigFilename() string
	GetDbFilename() string
	GetDebug() (bool, bool)
	GetDebugJourneycard() (bool, bool)
	GetDisplayRawUntrustedOutput() (bool, bool)
	GetGpg() string
	GetGpgHome() string
	GetGpgOptions() []string
	GetGregorDisabled() (bool, bool)
	GetSecretStorePrimingDisabled() (bool, bool)
	GetBGIdentifierDisabled() (bool, bool)
	GetGregorPingInterval() (time.Duration, bool)
	GetGregorPingTimeout() (time.Duration, bool)
	GetGregorSaveInterval() (time.Duration, bool)
	GetGregorURI() string
	GetHome() string
	GetMobileSharedHome() string
	GetLinkCacheSize() (int, bool)
	GetLocalRPCDebug() string
	GetLocalTrackMaxAge() (time.Duration, bool)
	GetLogFile() string
	GetEKLogFile() string
	GetGUILogFile() string
	GetUseDefaultLogFile() (bool, bool)
	GetUseRootConfigFile() (bool, bool)
	GetLogPrefix() string
	GetLogFormat() string
	GetMerkleKIDs() []string
	GetMountDir() string
	GetMountDirDefault() string
	GetPidFile() string
	GetPinentry() string
	GetProofCacheSize() (int, bool)
	GetProxy() string
	GetProxyType() string
	IsCertPinningEnabled() bool
	GetRunMode() (RunMode, error)
	GetScraperTimeout() (time.Duration, bool)
	GetSecretKeyringTemplate() string
	GetServerURI() (string, error)
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
	GetGUIConfigFilename() string
	GetDeviceCloneStateFilename() string
	GetUserCacheMaxAge() (time.Duration, bool)
	GetVDebugSetting() string
	GetChatDelivererInterval() (time.Duration, bool)
	GetFeatureFlags() (FeatureFlags, error)
	GetLevelDBNumFiles() (int, bool)
	GetChatInboxSourceLocalizeThreads() (int, bool)
	GetPayloadCacheSize() (int, bool)
	GetRememberPassphrase(NormalizedUsername) (bool, bool)
	GetAttachmentHTTPStartPort() (int, bool)
	GetAttachmentDisableMulti() (bool, bool)
	GetChatOutboxStorageEngine() string
	GetDisableTeamAuditor() (bool, bool)
	GetDisableTeamBoxAuditor() (bool, bool)
	GetDisableEKBackgroundKeygen() (bool, bool)
	GetDisableMerkleAuditor() (bool, bool)
	GetDisableSearchIndexer() (bool, bool)
	GetDisableBgConvLoader() (bool, bool)
	GetEnableBotLiteMode() (bool, bool)
	GetExtraNetLogging() (bool, bool)
	GetForceLinuxKeyring() (bool, bool)
	GetForceSecretStoreFile() (bool, bool)
	GetRuntimeStatsEnabled() (bool, bool)
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

type DBKeySet map[DbKey]bool

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
	Stats() string
	CompactionStats() (bool, bool, error)
	ForceOpen() error
	Close() error
	Nuke() (string, error)
	Clean(force bool) error
	OpenTransaction() (LocalDbTransaction, error)
	KeysWithPrefixes(prefixes ...[]byte) (DBKeySet, error)
}

type KVStorer interface {
	GetInto(obj interface{}, id DbKey) (found bool, err error)
	PutObj(id DbKey, aliases []DbKey, obj interface{}) (err error)
	Delete(id DbKey) error
	KeysWithPrefixes(prefixes ...[]byte) (DBKeySet, error)
}

type JSONReader interface {
	GetStringAtPath(string) (string, bool)
	GetInterfaceAtPath(string) (interface{}, error)
	GetBoolAtPath(string) (bool, bool)
	GetIntAtPath(string) (int, bool)
	GetFloatAtPath(string) (float64, bool)
	GetNullAtPath(string) bool
}

type ConfigReader interface {
	JSONReader
	configGetter

	GetUserConfig() (*UserConfig, error)
	GetUserConfigForUsername(s NormalizedUsername) (*UserConfig, error)
	GetBundledCA(host string) string
	GetProofCacheLongDur() (time.Duration, bool)
	GetProofCacheMediumDur() (time.Duration, bool)
	GetProofCacheShortDur() (time.Duration, bool)
	GetLinkCacheCleanDur() (time.Duration, bool)
	GetNoPinentry() (bool, bool)
	GetDeviceID() keybase1.DeviceID
	GetDeviceIDForUsername(nu NormalizedUsername) keybase1.DeviceID
	GetPassphraseState() *keybase1.PassphraseState
	GetPassphraseStateForUsername(nu NormalizedUsername) *keybase1.PassphraseState
	GetDeviceIDForUID(u keybase1.UID) keybase1.DeviceID
	GetUsernameForUID(u keybase1.UID) NormalizedUsername
	GetUIDForUsername(n NormalizedUsername) keybase1.UID
	GetUsername() NormalizedUsername
	GetAllUsernames() (current NormalizedUsername, others []NormalizedUsername, err error)
	GetAllUserConfigs() (*UserConfig, []UserConfig, error)
	GetUID() keybase1.UID
	GetProxyCACerts() ([]string, error)
	GetSecurityAccessGroupOverride() (bool, bool)
	GetBug3964RepairTime(NormalizedUsername) (time.Time, error)
	GetStayLoggedOut() (bool, bool)

	GetUpdatePreferenceAuto() (bool, bool)
	GetUpdatePreferenceSkip() string
	GetUpdatePreferenceSnoozeUntil() keybase1.Time
	GetUpdateLastChecked() keybase1.Time
	GetUpdateURL() string
	GetUpdateDisabled() (bool, bool)
}

type UpdaterConfigReader interface {
	GetInstallID() InstallID
}

type ConfigWriterTransacter interface {
	Commit() error
	Rollback() error
	Abort() error
}

type JSONWriter interface {
	SetStringAtPath(string, string) error
	SetBoolAtPath(string, bool) error
	SetIntAtPath(string, int) error
	SetFloatAtPath(string, float64) error
	SetNullAtPath(string) error
	SetWrapperAtPath(string, *jsonw.Wrapper) error
	DeleteAtPath(string)
}

type ConfigWriter interface {
	JSONWriter
	SetUserConfig(cfg *UserConfig, overwrite bool) error
	SwitchUser(un NormalizedUsername) error
	NukeUser(un NormalizedUsername) error
	SetDeviceID(keybase1.DeviceID) error
	SetUpdatePreferenceAuto(bool) error
	SetUpdatePreferenceSkip(string) error
	SetUpdatePreferenceSnoozeUntil(keybase1.Time) error
	SetUpdateLastChecked(keybase1.Time) error
	SetBug3964RepairTime(NormalizedUsername, time.Time) error
	SetRememberPassphrase(NormalizedUsername, bool) error
	SetPassphraseState(keybase1.PassphraseState) error
	SetStayLoggedOut(bool) error
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
	AllowRoot  bool
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
	Get(MetaContext, APIArg) (*APIRes, error)
	GetDecode(MetaContext, APIArg, APIResponseWrapper) error
	GetDecodeCtx(context.Context, APIArg, APIResponseWrapper) error
	GetResp(MetaContext, APIArg) (*http.Response, func(), error)
	Post(MetaContext, APIArg) (*APIRes, error)
	PostJSON(MetaContext, APIArg) (*APIRes, error)
	PostDecode(MetaContext, APIArg, APIResponseWrapper) error
	PostDecodeCtx(context.Context, APIArg, APIResponseWrapper) error
	PostRaw(MetaContext, APIArg, string, io.Reader) (*APIRes, error)
	Delete(MetaContext, APIArg) (*APIRes, error)
}

type ExternalAPI interface {
	Get(MetaContext, APIArg) (*ExternalAPIRes, error)
	Post(MetaContext, APIArg) (*ExternalAPIRes, error)
	GetHTML(MetaContext, APIArg) (*ExternalHTMLRes, error)
	GetText(MetaContext, APIArg) (*ExternalTextRes, error)
	PostHTML(MetaContext, APIArg) (*ExternalHTMLRes, error)
}

type IdentifyUI interface {
	Start(MetaContext, string, keybase1.IdentifyReason, bool) error
	FinishWebProofCheck(MetaContext, keybase1.RemoteProof, keybase1.LinkCheckResult) error
	FinishSocialProofCheck(MetaContext, keybase1.RemoteProof, keybase1.LinkCheckResult) error
	Confirm(MetaContext, *keybase1.IdentifyOutcome) (keybase1.ConfirmResult, error)
	DisplayCryptocurrency(MetaContext, keybase1.Cryptocurrency) error
	DisplayStellarAccount(MetaContext, keybase1.StellarAccount) error
	DisplayKey(MetaContext, keybase1.IdentifyKey) error
	ReportLastTrack(MetaContext, *keybase1.TrackSummary) error
	LaunchNetworkChecks(MetaContext, *keybase1.Identity, *keybase1.User) error
	DisplayTrackStatement(MetaContext, string) error
	DisplayUserCard(MetaContext, keybase1.UserCard) error
	ReportTrackToken(MetaContext, keybase1.TrackToken) error
	Cancel(MetaContext) error
	Finish(MetaContext) error
	DisplayTLFCreateWithInvite(MetaContext, keybase1.DisplayTLFCreateWithInviteArg) error
	Dismiss(MetaContext, string, keybase1.DismissReason) error
}

type Checker struct {
	F             func(string) bool
	Transform     func(string) string
	Normalize     func(string) string
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
	Checking(context.Context, keybase1.CheckingArg) error
	ContinueChecking(context.Context, int) (bool, error)
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
	ChatAttachmentDownloadStart(context.Context) error
	ChatAttachmentDownloadProgress(context.Context, chat1.ChatAttachmentDownloadProgressArg) error
	ChatAttachmentDownloadDone(context.Context) error
	ChatInboxUnverified(context.Context, chat1.ChatInboxUnverifiedArg) error
	ChatInboxConversation(context.Context, chat1.ChatInboxConversationArg) error
	ChatInboxFailed(context.Context, chat1.ChatInboxFailedArg) error
	ChatInboxLayout(context.Context, string) error
	ChatThreadCached(context.Context, *string) error
	ChatThreadFull(context.Context, string) error
	ChatThreadStatus(context.Context, chat1.UIChatThreadStatus) error
	ChatConfirmChannelDelete(context.Context, chat1.ChatConfirmChannelDeleteArg) (bool, error)
	ChatSearchHit(context.Context, chat1.ChatSearchHitArg) error
	ChatSearchDone(context.Context, chat1.ChatSearchDoneArg) error
	ChatSearchInboxHit(context.Context, chat1.ChatSearchInboxHitArg) error
	ChatSearchInboxStart(context.Context) error
	ChatSearchInboxDone(context.Context, chat1.ChatSearchInboxDoneArg) error
	ChatSearchIndexStatus(context.Context, chat1.ChatSearchIndexStatusArg) error
	ChatSearchConvHits(context.Context, chat1.UIChatSearchConvHits) error
	ChatStellarShowConfirm(context.Context) error
	ChatStellarDataConfirm(context.Context, chat1.UIChatPaymentSummary) (bool, error)
	ChatStellarDataError(context.Context, keybase1.Status) (bool, error)
	ChatStellarDone(context.Context, bool) error
	ChatGiphySearchResults(ctx context.Context, convID chat1.ConversationID,
		results chat1.GiphySearchResults) error
	ChatGiphyToggleResultWindow(ctx context.Context, convID chat1.ConversationID, show, clearInput bool) error
	ChatShowManageChannels(context.Context, string) error
	ChatCoinFlipStatus(context.Context, []chat1.UICoinFlipStatus) error
	ChatCommandMarkdown(context.Context, chat1.ConversationID, *chat1.UICommandMarkdown) error
	ChatMaybeMentionUpdate(context.Context, string, string, chat1.UIMaybeMentionInfo) error
	ChatLoadGalleryHit(context.Context, chat1.UIMessage) error
	ChatWatchPosition(context.Context, chat1.ConversationID, chat1.UIWatchPositionPerm) (chat1.LocationWatchID, error)
	ChatClearWatch(context.Context, chat1.LocationWatchID) error
	ChatCommandStatus(context.Context, chat1.ConversationID, string, chat1.UICommandStatusDisplayTyp,
		[]chat1.UICommandStatusActionTyp) error
	ChatBotCommandsUpdateStatus(context.Context, chat1.ConversationID, chat1.UIBotCommandsUpdateStatus) error
	TriggerContactSync(context.Context) error
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
	// The ErrorWriter is not escaped: it should not be used to show unescaped user-originated data.
	ErrorWriter() io.Writer
	Output(string) error
	OutputDesc(OutputDescriptor, string) error
	OutputWriter() io.Writer
	UnescapedOutputWriter() io.Writer
	Printf(fmt string, args ...interface{}) (int, error)
	PrintfUnescaped(fmt string, args ...interface{}) (int, error)
	// Prompt strings are not escaped: they should not be used to show unescaped user-originated data.
	Prompt(PromptDescriptor, string) (string, error)
	PromptForConfirmation(prompt string) error
	PromptPassword(PromptDescriptor, string) (string, error)
	PromptPasswordMaybeScripted(PromptDescriptor, string) (string, error)
	PromptYesNo(PromptDescriptor, string, PromptDefault) (bool, error)
	TerminalSize() (width int, height int)
}

type DumbOutputUI interface {
	Printf(fmt string, args ...interface{}) (int, error)
	PrintfStderr(fmt string, args ...interface{}) (int, error)
	PrintfUnescaped(fmt string, args ...interface{}) (int, error)
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
	GetHomeUI() (keybase1.HomeUIInterface, error)
	GetIdentify3UIAdapter(MetaContext) (IdentifyUI, error)
	GetIdentify3UI(MetaContext) (keybase1.Identify3UiInterface, error)
	GetChatUI() (ChatUI, error)

	DumpUIs() map[UIKind]ConnectionID
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

type GregorState interface {
	State(ctx context.Context) (gregor.State, error)
	UpdateCategory(ctx context.Context, cat string, body []byte,
		dtime gregor1.TimeOrOffset) (res gregor1.MsgID, err error)
	InjectItem(ctx context.Context, cat string, body []byte, dtime gregor1.TimeOrOffset) (gregor1.MsgID, error)
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
	GetServerURI() (string, error)
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

type AssertionContext interface {
	Ctx() context.Context
	NormalizeSocialName(service string, username string) (string, error)
}

// ProofChecker is an interface for performing a remote check for a proof

type ProofCheckerMode int

const (
	ProofCheckerModePassive ProofCheckerMode = iota
	ProofCheckerModeActive  ProofCheckerMode = iota
)

type ProofChecker interface {
	// `h` is the server provided sigHint. If the client can provide validated
	// information it returns this. The verifiedSigHint is preferred over the
	// server-trust one when displaying to users.
	CheckStatus(m MetaContext, h SigHint, pcm ProofCheckerMode, pvlU keybase1.MerkleStoreEntry) (*SigHint, ProofError)
	GetTorError() ProofError
}

// ServiceType is an interface for describing an external proof service, like 'Twitter'
// or 'GitHub', etc.
type ServiceType interface {
	Key() string

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
	NormalizeRemoteName(m MetaContext, name string) (string, error)

	GetPrompt() string
	LastWriterWins() bool
	PreProofCheck(m MetaContext, remotename string) (*Markup, error)
	PreProofWarning(remotename string) *Markup
	ToServiceJSON(remotename string) *jsonw.Wrapper
	PostInstructions(remotename string) *Markup
	DisplayName() string
	RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, remotename string) (warning *Markup, err error)
	GetProofType() string
	GetTypeName() string
	PickerSubtext() string
	CheckProofText(text string, id keybase1.SigID, sig string) error
	FormatProofText(mctx MetaContext, ppr *PostProofRes,
		kbUsername, remoteUsername string, sigID keybase1.SigID) (string, error)
	GetAPIArgKey() string
	IsDevelOnly() bool
	GetLogoKey() string

	MakeProofChecker(l RemoteProofChainLink) ProofChecker
	SetDisplayConfig(*keybase1.ServiceDisplayConfig)
	CanMakeNewProofs(mctx MetaContext) bool
	CanMakeNewProofsSkipFeatureFlag(mctx MetaContext) bool
	DisplayPriority() int
	DisplayGroup() string
	IsNew(MetaContext) bool
}

type ExternalServicesCollector interface {
	GetServiceType(context.Context, string) ServiceType
	ListProofCheckers(MetaContext) []string
	ListServicesThatAcceptNewProofs(MetaContext) []string
	ListDisplayConfigs(MetaContext) (res []keybase1.ServiceDisplayConfig)
	SuggestionFoldPriority(MetaContext) int
}

// Generic store for data that is hashed into the merkle root. Used by pvl and
// parameterized proofs.
type MerkleStore interface {
	GetLatestEntry(m MetaContext) (keybase1.MerkleStoreEntry, error)
	GetLatestEntryWithKnown(MetaContext, *keybase1.MerkleStoreKitHash) (*keybase1.MerkleStoreEntry, error)
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
	MapTeamAncestors(ctx context.Context, f func(t keybase1.TeamSigChainState) error, teamID keybase1.TeamID, reason string, forceFullReloadOnceToAssert func(t keybase1.TeamSigChainState) bool) error
	NotifyTeamRename(ctx context.Context, id keybase1.TeamID, newName string) error
	Load(context.Context, keybase1.LoadTeamArg) (*keybase1.TeamData, *keybase1.HiddenTeamChain, error)
	// Freezing a team clears most data and forces a full reload when the team
	// is loaded again. The team loader checks that the previous tail is
	// contained within the new chain post-freeze. In particular, since we load
	// a team before deleting it in response to the server-driven delete gregor
	// notifications, the server can't roll-back to a state where the team is
	// undeleted, so we don't have to special-case team deletion.
	Freeze(ctx context.Context, teamID keybase1.TeamID) error
	// Tombstoning a team prevents it from being loaded ever again, as long as
	// that cache entry exists. Used to prevent server from "undeleting" a
	// team. While a team is tombstoned, most data is cleared.
	Tombstone(ctx context.Context, teamID keybase1.TeamID) error
	// Untrusted hint of what a team's latest seqno is
	HintLatestSeqno(ctx context.Context, id keybase1.TeamID, seqno keybase1.Seqno) error
	ResolveNameToIDUntrusted(ctx context.Context, teamName keybase1.TeamName, public bool, allowCache bool) (id keybase1.TeamID, err error)
	ForceRepollUntil(ctx context.Context, t gregor.TimeOrOffset) error
	// Clear the in-memory cache. Does not affect the disk cache.
	ClearMem()
}

type FastTeamLoader interface {
	Load(MetaContext, keybase1.FastTeamLoadArg) (keybase1.FastTeamLoadRes, error)
	// Untrusted hint of what a team's latest seqno is
	HintLatestSeqno(m MetaContext, id keybase1.TeamID, seqno keybase1.Seqno) error
	VerifyTeamName(m MetaContext, id keybase1.TeamID, name keybase1.TeamName, forceRefresh bool) error
	ForceRepollUntil(m MetaContext, t gregor.TimeOrOffset) error
	// See comment in TeamLoader#Freeze.
	Freeze(MetaContext, keybase1.TeamID) error
	// See comment in TeamLoader#Tombstone.
	Tombstone(MetaContext, keybase1.TeamID) error
}

type HiddenTeamChainManager interface {
	// We got gossip about what the latest chain-tail should be, so ratchet the
	// chain forward; the next call to Advance() has to match.
	Ratchet(MetaContext, keybase1.TeamID, keybase1.HiddenTeamChainRatchetSet) error
	// We got a bunch of new links downloaded via slow or fast loader, so add them
	// onto the HiddenTeamChain state. Ensure that the updated state is at least up to the
	// given ratchet value.
	Advance(mctx MetaContext, update keybase1.HiddenTeamChain, expectedPrev *keybase1.LinkTriple) error
	// Access the tail of the HiddenTeamChain, for embedding into gossip vectors.
	Tail(MetaContext, keybase1.TeamID) (*keybase1.LinkTriple, error)
	// Load the latest data for the given team ID, and just return it wholesale.
	Load(MetaContext, keybase1.TeamID) (dat *keybase1.HiddenTeamChain, err error)
	// See comment in TeamLoader#Freeze.
	Freeze(MetaContext, keybase1.TeamID) error
	// See comment in TeamLoader#Tombstone.
	Tombstone(MetaContext, keybase1.TeamID) error
	// Untrusted hint of what a team's latest seqno is
	HintLatestSeqno(m MetaContext, id keybase1.TeamID, seqno keybase1.Seqno) error
}

type TeamAuditor interface {
	AuditTeam(m MetaContext, id keybase1.TeamID, isPublic bool, headMerkleSeqno keybase1.Seqno, chain map[keybase1.Seqno]keybase1.LinkID, maxSeqno keybase1.Seqno, auditMode keybase1.AuditMode) (err error)
}

type TeamBoxAuditor interface {
	AssertUnjailedOrReaudit(m MetaContext, id keybase1.TeamID) (didReaudit bool, err error)
	IsInJail(m MetaContext, id keybase1.TeamID) (bool, error)
	RetryNextBoxAudit(m MetaContext) (attempt *keybase1.BoxAuditAttempt, err error)
	BoxAuditRandomTeam(m MetaContext) (attempt *keybase1.BoxAuditAttempt, err error)
	BoxAuditTeam(m MetaContext, id keybase1.TeamID) (attempt *keybase1.BoxAuditAttempt, err error)
	MaybeScheduleDelayedBoxAuditTeam(m MetaContext, id keybase1.TeamID)
	Attempt(m MetaContext, id keybase1.TeamID, rotateBeforeAudit bool) keybase1.BoxAuditAttempt
}

// MiniChatPayment is the argument for sending an in-chat payment.
type MiniChatPayment struct {
	Username NormalizedUsername
	Amount   string
	Currency string
}

// MiniChatPaymentResult is the result of sending an in-chat payment to
// one username.
type MiniChatPaymentResult struct {
	Username  NormalizedUsername
	PaymentID stellar1.PaymentID
	Error     error
}

// MiniChatPaymentSpec describes the amounts involved in a MiniChatPayment.
type MiniChatPaymentSpec struct {
	Username      NormalizedUsername
	Error         error
	XLMAmount     string
	DisplayAmount string // optional
}

// MiniChatPaymentSummary contains all the recipients and the amounts they
// will receive plus a total in XLM and in the sender's preferred currency.
type MiniChatPaymentSummary struct {
	Specs        []MiniChatPaymentSpec
	XLMTotal     string
	DisplayTotal string
}

type Stellar interface {
	CreateWalletSoft(context.Context)
	Upkeep(context.Context) error
	GetServerDefinitions(context.Context) (stellar1.StellarServerDefinitions, error)
	KickAutoClaimRunner(MetaContext, gregor.MsgID)
	UpdateUnreadCount(ctx context.Context, accountID stellar1.AccountID, unread int) error
	SpecMiniChatPayments(mctx MetaContext, payments []MiniChatPayment) (*MiniChatPaymentSummary, error)
	SendMiniChatPayments(mctx MetaContext, convID chat1.ConversationID, payments []MiniChatPayment) ([]MiniChatPaymentResult, error)
	HandleOobm(context.Context, gregor.OutOfBandMessage) (bool, error)
	RemovePendingTx(mctx MetaContext, accountID stellar1.AccountID, txID stellar1.TransactionID) error
	KnownCurrencyCodeInstant(ctx context.Context, code string) (known, ok bool)
	InformBundle(MetaContext, stellar1.BundleRevision, []stellar1.BundleEntry)
	InformDefaultCurrencyChange(MetaContext)
}

type DeviceEKStorage interface {
	Put(mctx MetaContext, generation keybase1.EkGeneration, deviceEK keybase1.DeviceEk) error
	Get(mctx MetaContext, generation keybase1.EkGeneration) (keybase1.DeviceEk, error)
	GetAllActive(mctx MetaContext, merkleRoot MerkleRoot) ([]keybase1.DeviceEkMetadata, error)
	MaxGeneration(mctx MetaContext, includeErrs bool) (keybase1.EkGeneration, error)
	DeleteExpired(mctx MetaContext, merkleRoot MerkleRoot) ([]keybase1.EkGeneration, error)
	ClearCache()
	// Dangerous! Only for deprovisioning or shutdown/logout when in oneshot mode.
	ForceDeleteAll(mctx MetaContext, username NormalizedUsername) error
	// For keybase log send
	ListAllForUser(mctx MetaContext) ([]string, error)
	// Called on login/logout hooks to set the logged in username in the EK log
	SetLogPrefix(mctx MetaContext)
}

type UserEKBoxStorage interface {
	Put(mctx MetaContext, generation keybase1.EkGeneration, userEKBoxed keybase1.UserEkBoxed) error
	Get(mctx MetaContext, generation keybase1.EkGeneration, contentCtime *gregor1.Time) (keybase1.UserEk, error)
	MaxGeneration(mctx MetaContext, includeErrs bool) (keybase1.EkGeneration, error)
	DeleteExpired(mctx MetaContext, merkleRoot MerkleRoot) ([]keybase1.EkGeneration, error)
	ClearCache()
}

type TeamEKBoxStorage interface {
	Put(mctx MetaContext, teamID keybase1.TeamID, generation keybase1.EkGeneration, teamEKBoxed keybase1.TeamEphemeralKeyBoxed) error
	Get(mctx MetaContext, teamID keybase1.TeamID, generation keybase1.EkGeneration, contentCtime *gregor1.Time) (keybase1.TeamEphemeralKey, error)
	MaxGeneration(mctx MetaContext, teamID keybase1.TeamID, includeErrs bool) (keybase1.EkGeneration, error)
	DeleteExpired(mctx MetaContext, teamID keybase1.TeamID, merkleRoot MerkleRoot) ([]keybase1.EkGeneration, error)
	PurgeCacheForTeamID(mctx MetaContext, teamID keybase1.TeamID) error
	Delete(mctx MetaContext, teamID keybase1.TeamID, generation keybase1.EkGeneration) error
	ClearCache()
}

type EKLib interface {
	KeygenIfNeeded(mctx MetaContext) error
	// Team ephemeral keys
	GetOrCreateLatestTeamEK(mctx MetaContext, teamID keybase1.TeamID) (keybase1.TeamEphemeralKey, bool, error)
	GetTeamEK(mctx MetaContext, teamID keybase1.TeamID, generation keybase1.EkGeneration, contentCtime *gregor1.Time) (keybase1.TeamEphemeralKey, error)
	PurgeTeamEKCachesForTeamIDAndGeneration(mctx MetaContext, teamID keybase1.TeamID, generation keybase1.EkGeneration)
	PurgeTeamEKCachesForTeamID(mctx MetaContext, teamID keybase1.TeamID)

	// Teambot ephemeral keys
	GetOrCreateLatestTeambotEK(mctx MetaContext, teamID keybase1.TeamID, botUID gregor1.UID) (keybase1.TeamEphemeralKey, bool, error)
	GetTeambotEK(mctx MetaContext, teamID keybase1.TeamID, botUID gregor1.UID, generation keybase1.EkGeneration, contentCtime *gregor1.Time) (keybase1.TeamEphemeralKey, error)
	PurgeTeambotEKCachesForTeamIDAndGeneration(mctx MetaContext, teamID keybase1.TeamID, generation keybase1.EkGeneration)
	PurgeTeambotEKCachesForTeamID(mctx MetaContext, teamID keybase1.TeamID)
	PurgeAllTeambotMetadataCaches(mctx MetaContext)
	PurgeTeambotMetadataCache(mctx MetaContext, teamID keybase1.TeamID, botUID keybase1.UID, generation keybase1.EkGeneration)

	NewEphemeralSeed() (keybase1.Bytes32, error)
	DeriveDeviceDHKey(seed keybase1.Bytes32) *NaclDHKeyPair
	SignedDeviceEKStatementFromSeed(mctx MetaContext, generation keybase1.EkGeneration, seed keybase1.Bytes32, signingKey GenericKey) (keybase1.DeviceEkStatement, string, error)
	BoxLatestUserEK(mctx MetaContext, receiverKey NaclDHKeyPair, deviceEKGeneration keybase1.EkGeneration) (*keybase1.UserEkBoxed, error)
	PrepareNewUserEK(mctx MetaContext, merkleRoot MerkleRoot, pukSeed PerUserKeySeed) (string, []keybase1.UserEkBoxMetadata, keybase1.UserEkMetadata, *keybase1.UserEkBoxed, error)
	BoxLatestTeamEK(mctx MetaContext, teamID keybase1.TeamID, uids []keybase1.UID) (*[]keybase1.TeamEkBoxMetadata, error)
	PrepareNewTeamEK(mctx MetaContext, teamID keybase1.TeamID, signingKey NaclSigningKeyPair, uids []keybase1.UID) (string, *[]keybase1.TeamEkBoxMetadata, keybase1.TeamEkMetadata, *keybase1.TeamEkBoxed, error)
	ClearCaches(mctx MetaContext)
	// For testing
	NewTeamEKNeeded(mctx MetaContext, teamID keybase1.TeamID) (bool, error)
}

type TeambotBotKeyer interface {
	GetLatestTeambotKey(mctx MetaContext, teamID keybase1.TeamID, app keybase1.TeamApplication) (keybase1.TeambotKey, error)
	GetTeambotKeyAtGeneration(mctx MetaContext, teamID keybase1.TeamID, app keybase1.TeamApplication,
		generation keybase1.TeambotKeyGeneration) (keybase1.TeambotKey, error)

	DeleteTeambotKeyForTest(mctx MetaContext, teamID keybase1.TeamID, app keybase1.TeamApplication,
		generation keybase1.TeambotKeyGeneration) error
}

type TeambotMemberKeyer interface {
	GetOrCreateTeambotKey(mctx MetaContext, teamID keybase1.TeamID, botUID gregor1.UID,
		appKey keybase1.TeamApplicationKey) (keybase1.TeambotKey, bool, error)
	PurgeCache(mctx MetaContext)
	PurgeCacheAtGeneration(mctx MetaContext, teamID keybase1.TeamID, botUID keybase1.UID,
		app keybase1.TeamApplication, generation keybase1.TeambotKeyGeneration)
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
	OnLogout(mctx MetaContext) error
	OnDbNuke(mctx MetaContext) error
}

type MemLRUer interface {
	Get(key interface{}) (interface{}, bool)
	Put(key, value interface{}) bool
	OnLogout(mctx MetaContext) error
	OnDbNuke(mctx MetaContext) error
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

	// MapHardcodedUsernameToUID will map the given legacy username to a UID if it exists
	// in the hardcoded map. If not, it will return the nil UID.
	MapHardcodedUsernameToUID(un NormalizedUsername) keybase1.UID

	// MapUIDToUsernamePackages maps the given set of UIDs to the username
	// packages, which include a username and a fullname, and when the mapping
	// was loaded from the server. It blocks on the network until all usernames
	// are known. If the `forceNetworkForFullNames` flag is specified, it will
	// block on the network too. If the flag is not specified, then stale
	// values (or unknown values) are OK, we won't go to network if we lack
	// them. All network calls are limited by the given timeBudget, or if 0 is
	// specified, there is indefinite budget. In the response, a nil
	// FullNamePackage means that the lookup failed. A non-nil FullNamePackage
	// means that some previous lookup worked, but might be arbitrarily out of
	// date (depending on the cachedAt time). A non-nil FullNamePackage with an
	// empty fullName field means that the user just hasn't supplied a
	// fullName.
	//
	// *NOTE* that this function can return useful data and an error. In this
	// regard, the error is more like a warning. But if, for instance, the
	// mapper runs out of time budget, it will return the data
	MapUIDsToUsernamePackages(ctx context.Context, g UIDMapperContext, uids []keybase1.UID, fullNameFreshness time.Duration,
		networktimeBudget time.Duration, forceNetworkForFullNames bool) ([]UsernamePackage, error)

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

	// MapUIDsToUsernamePackagesOffline maps given set of UIDs to username packages
	// from the cache only. No network calls will be made. Results might contains
	// unresolved usernames (caller should check with `IsNil()`).
	MapUIDsToUsernamePackagesOffline(ctx context.Context, g UIDMapperContext,
		uids []keybase1.UID, fullNameFreshness time.Duration) ([]UsernamePackage, error)
}

type UserServiceSummary map[string]string // service -> username
type UserServiceSummaryPackage struct {
	CachedAt   keybase1.Time
	ServiceMap UserServiceSummary
}

type ServiceSummaryMapper interface {
	MapUIDsToServiceSummaries(ctx context.Context, g UIDMapperContext, uids []keybase1.UID, freshness time.Duration,
		networkTimeBudget time.Duration) map[keybase1.UID]UserServiceSummaryPackage
	InformOfServiceSummary(ctx context.Context, g UIDMapperContext, uid keybase1.UID, summary UserServiceSummary) error
}

type ChatHelper interface {
	NewConversation(ctx context.Context, uid gregor1.UID, tlfName string,
		topicName *string, topicType chat1.TopicType, membersType chat1.ConversationMembersType,
		vis keybase1.TLFVisibility) (chat1.ConversationLocal, error)
	NewConversationSkipFindExisting(ctx context.Context, uid gregor1.UID, tlfName string,
		topicName *string, topicType chat1.TopicType, membersType chat1.ConversationMembersType,
		vis keybase1.TLFVisibility) (chat1.ConversationLocal, error)
	NewConversationWithMemberSourceConv(ctx context.Context, uid gregor1.UID, tlfName string,
		topicName *string, topicType chat1.TopicType, membersType chat1.ConversationMembersType,
		vis keybase1.TLFVisibility, memberSourceConv *chat1.ConversationID) (chat1.ConversationLocal, error)
	SendTextByID(ctx context.Context, convID chat1.ConversationID,
		tlfName string, text string, vis keybase1.TLFVisibility) error
	SendMsgByID(ctx context.Context, convID chat1.ConversationID,
		tlfName string, body chat1.MessageBody, msgType chat1.MessageType, vis keybase1.TLFVisibility) error
	SendTextByIDNonblock(ctx context.Context, convID chat1.ConversationID,
		tlfName string, text string, outboxID *chat1.OutboxID, replyTo *chat1.MessageID) (chat1.OutboxID, error)
	SendMsgByIDNonblock(ctx context.Context, convID chat1.ConversationID,
		tlfName string, body chat1.MessageBody, msgType chat1.MessageType, outboxID *chat1.OutboxID,
		replyTo *chat1.MessageID) (chat1.OutboxID, error)
	SendTextByName(ctx context.Context, name string, topicName *string,
		membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, text string) error
	SendMsgByName(ctx context.Context, name string, topicName *string,
		membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, body chat1.MessageBody,
		msgType chat1.MessageType) error
	SendTextByNameNonblock(ctx context.Context, name string, topicName *string,
		membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, text string,
		outboxID *chat1.OutboxID) (chat1.OutboxID, error)
	SendMsgByNameNonblock(ctx context.Context, name string, topicName *string,
		membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, body chat1.MessageBody,
		msgType chat1.MessageType, outboxID *chat1.OutboxID) (chat1.OutboxID, error)
	DeleteMsg(ctx context.Context, convID chat1.ConversationID, tlfName string,
		msgID chat1.MessageID) error
	DeleteMsgNonblock(ctx context.Context, convID chat1.ConversationID, tlfName string,
		msgID chat1.MessageID) error
	FindConversations(ctx context.Context, name string,
		topicName *string, topicType chat1.TopicType, membersType chat1.ConversationMembersType,
		vis keybase1.TLFVisibility) ([]chat1.ConversationLocal, error)
	FindConversationsByID(ctx context.Context, convIDs []chat1.ConversationID) ([]chat1.ConversationLocal, error)
	JoinConversationByID(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) error
	JoinConversationByName(ctx context.Context, uid gregor1.UID, tlfName, topicName string,
		topicType chat1.TopicType, vid keybase1.TLFVisibility) error
	LeaveConversation(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) error
	GetChannelTopicName(context.Context, keybase1.TeamID, chat1.TopicType, chat1.ConversationID) (string, error)
	GetMessages(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
		msgIDs []chat1.MessageID, resolveSupersedes bool, reason *chat1.GetThreadReason) ([]chat1.MessageUnboxed, error)
	GetMessage(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
		msgID chat1.MessageID, resolveSupersedes bool, reason *chat1.GetThreadReason) (chat1.MessageUnboxed, error)
	UpgradeKBFSToImpteam(ctx context.Context, tlfName string, tlfID chat1.TLFID, public bool) error
	UserReacjis(ctx context.Context, uid gregor1.UID) keybase1.UserReacjis
}

// Resolver resolves human-readable usernames (joe) and user asssertions (joe+joe@github)
// into UIDs. It is based on sever-trust. All results are unverified. So you should check
// its answer if used in a security-sensitive setting. (See engine.ResolveAndCheck)
type Resolver interface {
	EnableCaching(m MetaContext)
	Shutdown(m MetaContext)
	ResolveFullExpression(m MetaContext, input string) (res ResolveResult)
	ResolveFullExpressionNeedUsername(m MetaContext, input string) (res ResolveResult)
	ResolveFullExpressionWithBody(m MetaContext, input string) (res ResolveResult)
	ResolveUser(m MetaContext, assertion string) (u keybase1.User, res ResolveResult, err error)
	ResolveWithBody(m MetaContext, input string) ResolveResult
	Resolve(m MetaContext, input string) ResolveResult
	PurgeResolveCache(m MetaContext, input string) error
	CacheTeamResolution(m MetaContext, id keybase1.TeamID, name keybase1.TeamName)
}

type EnginePrereqs struct {
	TemporarySession bool
	Device           bool
}

type Engine2 interface {
	Run(MetaContext) error
	Prereqs() EnginePrereqs
	UIConsumer
}

type SaltpackRecipientKeyfinderEngineInterface interface {
	Engine2
	GetPublicKIDs() []keybase1.KID
	GetSymmetricKeys() []SaltpackReceiverSymmetricKey
}

type SaltpackRecipientKeyfinderArg struct {
	Recipients        []string // usernames or user assertions
	TeamRecipients    []string // team names
	NoSelfEncrypt     bool
	UseEntityKeys     bool // Both per user and per team keys (and implicit teams for non existing users)
	UsePaperKeys      bool
	UseDeviceKeys     bool // Does not include Paper Keys
	UseRepudiableAuth bool // This is needed as team keys (implicit or not) are not compatible with repudiable authentication, so we can error out.
}

type SaltpackReceiverSymmetricKey struct {
	Key        [32]byte
	Identifier []byte
}

type StandaloneChatConnector interface {
	StartStandaloneChat(g *GlobalContext) error
}

type SyncedContactListProvider interface {
	SaveProcessedContacts(MetaContext, []keybase1.ProcessedContact) error
	RetrieveContacts(MetaContext) ([]keybase1.ProcessedContact, error)
	RetrieveAssertionToName(MetaContext) (map[string]string, error)
	UnresolveContactsWithComponent(MetaContext, *keybase1.PhoneNumber, *keybase1.EmailAddress)
}

type KVRevisionCacher interface {
	Check(mctx MetaContext, entryID keybase1.KVEntryID, ciphertext *string, teamKeyGen keybase1.PerTeamKeyGeneration, revision int) (err error)
	Put(mctx MetaContext, entryID keybase1.KVEntryID, ciphertext *string, teamKeyGen keybase1.PerTeamKeyGeneration, revision int) (err error)
	CheckForUpdate(mctx MetaContext, entryID keybase1.KVEntryID, revision int) (err error)
	MarkDeleted(mctx MetaContext, entryID keybase1.KVEntryID, revision int) (err error)
}
