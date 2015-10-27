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
	"net/url"
	"time"

	"golang.org/x/net/context"

	"github.com/PuerkitoBio/goquery"
	keybase1 "github.com/keybase/client/go/protocol"
	jsonw "github.com/keybase/go-jsonw"
)

type CommandLine interface {
	GetHome() string
	GetServerURI() string
	GetConfigFilename() string
	GetSessionFilename() string
	GetDbFilename() string
	GetDebug() (bool, bool)
	GetProxy() string
	GetLogFormat() string
	GetGpgHome() string
	GetAPIDump() (bool, bool)
	GetUserCacheMaxAge() (time.Duration, bool)
	GetProofCacheSize() (int, bool)
	GetMerkleKIDs() []string
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
	GetSplitLogOutput() (bool, bool)
	GetLogFile() string
	GetRunMode() (RunMode, error)

	GetScraperTimeout() (time.Duration, bool)
	GetAPITimeout() (time.Duration, bool)

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
	GetSessionFilename() string
	GetDbFilename() string
	GetDebug() (bool, bool)
	GetAutoFork() (bool, bool)
	GetUserConfig() (*UserConfig, error)
	GetUserConfigForUsername(s NormalizedUsername) (*UserConfig, error)
	GetProxy() string
	GetLogFormat() string
	GetGpgHome() string
	GetBundledCA(host string) string
	GetStringAtPath(string) (string, bool)
	GetBoolAtPath(string) (bool, bool)
	GetIntAtPath(string) (int, bool)
	GetNullAtPath(string) bool
	GetUserCacheMaxAge() (time.Duration, bool)
	GetProofCacheSize() (int, bool)
	GetProofCacheLongDur() (time.Duration, bool)
	GetProofCacheMediumDur() (time.Duration, bool)
	GetProofCacheShortDur() (time.Duration, bool)
	GetMerkleKIDs() []string
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
	GetSplitLogOutput() (bool, bool)
	GetLogFile() string
	GetRunMode() (RunMode, error)
	GetScraperTimeout() (time.Duration, bool)
	GetAPITimeout() (time.Duration, bool)
	GetSecurityAccessGroupOverride() (bool, bool)
}

type ConfigWriter interface {
	SetUserConfig(cfg *UserConfig, overwrite bool) error
	SwitchUser(un NormalizedUsername) error
	SetDeviceID(keybase1.DeviceID) error
	SetStringAtPath(string, string) error
	SetBoolAtPath(string, bool) error
	SetIntAtPath(string, int) error
	SetNullAtPath(string) error
	DeleteAtPath(string)
	Reset()
	Write() error
}

type HTTPRequest interface {
	SetEnvironment(env Env)
}

type ProofCheckers interface {
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

type APIArg struct {
	Endpoint    string
	uArgs       url.Values
	Args        HTTPArgs
	JSONPayload JSONPayload
	NeedSession bool
	SessionR    SessionReader
	HTTPStatus  []int
	AppStatus   []string
	DecodeTo    interface{}
	Contextified
}

type APIRes struct {
	Status     *jsonw.Wrapper
	Body       *jsonw.Wrapper
	HTTPStatus int
	AppStatus  string
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
	GetDecode(APIArg, interface{}) error
	Post(APIArg) (*APIRes, error)
	PostJSON(APIArg) (*APIRes, error)
	PostResp(APIArg) (*http.Response, error)
	PostDecode(APIArg, interface{}) error
}

type ExternalAPI interface {
	Get(APIArg) (*ExternalAPIRes, error)
	Post(APIArg) (*ExternalAPIRes, error)
	GetHTML(APIArg) (*ExternalHTMLRes, error)
	GetText(APIArg) (*ExternalTextRes, error)
	PostHTML(APIArg) (*ExternalHTMLRes, error)
}

type IdentifyUI interface {
	Start(string)
	FinishWebProofCheck(keybase1.RemoteProof, keybase1.LinkCheckResult)
	FinishSocialProofCheck(keybase1.RemoteProof, keybase1.LinkCheckResult)
	Confirm(*keybase1.IdentifyOutcome) (bool, error)
	DisplayCryptocurrency(keybase1.Cryptocurrency)
	DisplayKey(keybase1.IdentifyKey)
	ReportLastTrack(*keybase1.TrackSummary)
	LaunchNetworkChecks(*keybase1.Identity, *keybase1.User)
	DisplayTrackStatement(string) error
	SetStrict(b bool)
	Finish()
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
	GetSecret(pinentry keybase1.SecretEntryArg, terminal *keybase1.SecretEntryArg) (*keybase1.SecretEntryRes, error)
	GetNewPassphrase(keybase1.GetNewPassphraseArg) (keybase1.GetNewPassphraseRes, error)
	GetKeybasePassphrase(keybase1.GetKeybasePassphraseArg) (string, error)
	GetPaperKeyPassphrase(keybase1.GetPaperKeyPassphraseArg) (string, error)
}

type LogUI interface {
	Debug(format string, args ...interface{})
	Info(format string, args ...interface{})
	Warning(format string, args ...interface{})
	Notice(format string, args ...interface{})
	Errorf(format string, args ...interface{})
	Critical(format string, args ...interface{})
}

type LocksmithUI interface {
	keybase1.LocksmithUiInterface
}

type GPGUI interface {
	keybase1.GpgUiInterface
}

type DoctorUI interface {
	LoginSelect(ctx context.Context, currentUser string, otherUsers []string) (string, error)
	DisplayStatus(ctx context.Context, status keybase1.DoctorStatus) (bool, error)
	DisplayResult(ctx context.Context, msg string) error
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

type TerminalUI interface {
	OutputWriter() io.Writer
	Output(string) error
	Printf(fmt string, args ...interface{}) (int, error)
	PromptYesNo(PromptDescriptor, string, PromptDefault) (bool, error)
	Prompt(PromptDescriptor, string) (string, error)
	PromptPassword(PromptDescriptor, string) (string, error)
}

type UI interface {
	GetDoctorUI() DoctorUI
	GetIdentifyUI() IdentifyUI
	GetIdentifyTrackUI(strict bool) IdentifyUI
	GetLoginUI() LoginUI
	GetSecretUI() SecretUI
	GetTerminalUI() TerminalUI
	GetProveUI() ProveUI
	GetLogUI() LogUI
	GetGPGUI() GPGUI
	GetLocksmithUI() LocksmithUI
	GetProvisionUI(provisioner bool) ProvisionUI
	Configure() error
	Shutdown() error
}

type UIConsumer interface {
	Name() string
	RequiredUIs() []UIKind
	SubConsumers() []UIConsumer
}
