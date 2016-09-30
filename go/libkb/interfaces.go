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
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

type CommandLine interface {
	GetHome() string
	GetServerURI() string
	GetConfigFilename() string
	GetUpdaterConfigFilename() string
	GetSessionFilename() string
	GetDbFilename() string
	GetDebug() (bool, bool)
	GetVDebugSetting() string
	GetProxy() string
	GetLogFile() string
	GetLogFormat() string
	GetGpgHome() string
	GetAPIDump() (bool, bool)
	GetGregorURI() string
	GetGregorSaveInterval() (time.Duration, bool)
	GetGregorDisabled() (bool, bool)
	GetGregorPingInterval() (time.Duration, bool)
	GetUserCacheMaxAge() (time.Duration, bool)
	GetProofCacheSize() (int, bool)
	GetLinkCacheSize() (int, bool)
	GetMerkleKIDs() []string
	GetCodeSigningKIDs() []string
	GetPinentry() string
	GetGpg() string
	GetGpgOptions() []string
	GetPGPFingerprint() *PGPFingerprint
	GetSecretKeyringTemplate() string
	GetSocketFile() string
	GetPidFile() string
	GetStandalone() (bool, bool)
	GetAutoFork() (bool, bool)
	GetNoAutoFork() (bool, bool)
	GetLocalRPCDebug() string
	GetTimers() string
	GetRunMode() (RunMode, error)

	GetScraperTimeout() (time.Duration, bool)
	GetAPITimeout() (time.Duration, bool)

	GetTorMode() (TorMode, error)
	GetTorHiddenAddress() string
	GetTorProxy() string
	GetLocalTrackMaxAge() (time.Duration, bool)

	GetMountDir() string

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

type LocalDb interface {
	Open() error
	ForceOpen() error
	Close() error
	Nuke() (string, error)
	Put(id DbKey, aliases []DbKey, value []byte) error
	Delete(id DbKey) error
	Get(id DbKey) ([]byte, bool, error)
	Lookup(alias DbKey) ([]byte, bool, error)
}

type ConfigReader interface {
	GetHome() string
	GetServerURI() string
	GetConfigFilename() string
	GetUpdaterConfigFilename() string
	GetSessionFilename() string
	GetDbFilename() string
	GetDebug() (bool, bool)
	GetVDebugSetting() string
	GetAutoFork() (bool, bool)
	GetUserConfig() (*UserConfig, error)
	GetUserConfigForUsername(s NormalizedUsername) (*UserConfig, error)
	GetProxy() string
	GetLogFormat() string
	GetGpgHome() string
	GetBundledCA(host string) string
	GetStringAtPath(string) (string, bool)
	GetInterfaceAtPath(string) (interface{}, error)
	GetBoolAtPath(string) (bool, bool)
	GetIntAtPath(string) (int, bool)
	GetNullAtPath(string) bool
	GetUserCacheMaxAge() (time.Duration, bool)
	GetProofCacheSize() (int, bool)
	GetProofCacheLongDur() (time.Duration, bool)
	GetProofCacheMediumDur() (time.Duration, bool)
	GetProofCacheShortDur() (time.Duration, bool)
	GetLinkCacheSize() (int, bool)
	GetLinkCacheCleanDur() (time.Duration, bool)
	GetMerkleKIDs() []string
	GetCodeSigningKIDs() []string
	GetPinentry() string
	GetNoPinentry() (bool, bool)
	GetGpg() string
	GetGpgOptions() []string
	GetSecretKeyringTemplate() string
	GetSalt() []byte
	GetSocketFile() string
	GetPidFile() string
	GetStandalone() (bool, bool)
	GetLocalRPCDebug() string
	GetTimers() string
	GetDeviceID() keybase1.DeviceID
	GetUsername() NormalizedUsername
	GetAllUsernames() (current NormalizedUsername, others []NormalizedUsername, err error)
	GetUID() keybase1.UID
	GetProxyCACerts() ([]string, error)
	GetLogFile() string
	GetRunMode() (RunMode, error)
	GetScraperTimeout() (time.Duration, bool)
	GetAPITimeout() (time.Duration, bool)
	GetSecurityAccessGroupOverride() (bool, bool)
	GetGregorURI() string
	GetGregorSaveInterval() (time.Duration, bool)
	GetGregorDisabled() (bool, bool)
	GetGregorPingInterval() (time.Duration, bool)
	GetMountDir() string

	GetUpdatePreferenceAuto() (bool, bool)
	GetUpdatePreferenceSkip() string
	GetUpdatePreferenceSnoozeUntil() keybase1.Time
	GetUpdateLastChecked() keybase1.Time
	GetUpdateURL() string
	GetUpdateDisabled() (bool, bool)
	GetLocalTrackMaxAge() (time.Duration, bool)
	IsAdmin() (bool, bool)

	GetTorMode() (TorMode, error)
	GetTorHiddenAddress() string
	GetTorProxy() string
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
	GetResp(APIArg) (*http.Response, error)
	GetDecode(APIArg, APIResponseWrapper) error
	Post(APIArg) (*APIRes, error)
	PostJSON(APIArg) (*APIRes, error)
	PostResp(APIArg) (*http.Response, error)
	PostDecode(APIArg, APIResponseWrapper) error
	PostRaw(APIArg, string, io.Reader) (*APIRes, error)
}

type ExternalAPI interface {
	Get(APIArg) (*ExternalAPIRes, error)
	Post(APIArg) (*ExternalAPIRes, error)
	GetHTML(APIArg) (*ExternalHTMLRes, error)
	GetText(APIArg) (*ExternalTextRes, error)
	PostHTML(APIArg) (*ExternalHTMLRes, error)
}

type IdentifyUI interface {
	Start(string, keybase1.IdentifyReason) error
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
	DismissItem(id gregor.MsgID) error
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

// APIContext defines methods for accessing API server
type APIContext interface {
	GetAPI() API
	GetExternalAPI() ExternalAPI
	GetServerURI() string
}

// ProofContext defines features needed by the proof system
type ProofContext interface {
	LogContext
	APIContext
}

type AssertionContext interface {
	NormalizeSocialName(service string, username string) (string, error)
}

// ProofChecker is an interface for performing a remote check for a proof
type ProofChecker interface {
	CheckHint(ctx ProofContext, h SigHint) ProofError
	CheckStatus(ctx ProofContext, h SigHint) ProofError
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
	FormatProofText(*PostProofRes) (string, error)
	GetAPIArgKey() string
	IsDevelOnly() bool

	MakeProofChecker(l RemoteProofChainLink) ProofChecker
}

type ExternalServicesCollector interface {
	GetServiceType(n string) ServiceType
	ListProofCheckers(mode RunMode) []string
}
