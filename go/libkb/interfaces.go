package libkb

/*
 * Interfaces
 *
 *   Here are the interfaces that we're going to assume when
 *   implementing the features of command-line clients or
 *   servers.  Depending on the conext, we might get different
 *   instantiations of these interfaces.
 */

import (
	"net/http"
	"net/url"

	"github.com/PuerkitoBio/goquery"
	keybase_1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

type CommandLine interface {
	GetHome() string
	GetUsername() string
	GetServerUri() string
	GetConfigFilename() string
	GetSessionFilename() string
	GetDbFilename() string
	GetDebug() (bool, bool)
	GetProxy() string
	GetPlainLogging() (bool, bool)
	GetGpgHome() string
	GetApiDump() (bool, bool)
	GetUserCacheSize() (int, bool)
	GetProofCacheSize() (int, bool)
	GetMerkleKeyFingerprints() []string
	GetPinentry() string
	GetGpg() string
	GetGpgOptions() []string
	GetGpgDisabled() (bool, bool)
	GetPgpFingerprint() *PgpFingerprint
	GetSecretKeyringTemplate() string
	GetSocketFile() string
	GetPidFile() string
	GetDaemonPort() (int, bool)
	GetStandalone() (bool, bool)
	GetLocalRpcDebug() string
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
	Nuke() error
	Put(id DbKey, aliases []DbKey, value []byte) error
	Delete(id DbKey) error
	Get(id DbKey) ([]byte, bool, error)
	Lookup(alias DbKey) ([]byte, bool, error)
}

type ConfigReader interface {
	GetHome() string
	GetServerUri() string
	GetConfigFilename() string
	GetSessionFilename() string
	GetDbFilename() string
	GetDebug() (bool, bool)
	GetUserConfig() (*UserConfig, error)
	GetUserConfigForUsername(s string) (*UserConfig, error)
	GetProxy() string
	GetPlainLogging() (bool, bool)
	GetGpgHome() string
	GetBundledCA(host string) string
	GetStringAtPath(string) (string, bool)
	GetBoolAtPath(string) (bool, bool)
	GetIntAtPath(string) (int, bool)
	GetNullAtPath(string) bool
	GetUserCacheSize() (int, bool)
	GetProofCacheSize() (int, bool)
	GetMerkleKeyFingerprints() []string
	GetPinentry() string
	GetNoPinentry() (bool, bool)
	GetGpg() string
	GetGpgOptions() []string
	GetGpgDisabled() (bool, bool)
	GetSecretKeyringTemplate() string
	GetSalt() []byte
	GetSocketFile() string
	GetPidFile() string
	GetDaemonPort() (int, bool)
	GetStandalone() (bool, bool)
	GetLocalRpcDebug() string
	GetDeviceID() *DeviceID
	GetUsername() string
	GetAllUsernames() (current string, others []string, err error)
	GetUID() *UID
	GetProxyCACerts() ([]string, error)
}

type ConfigWriter interface {
	SetUserConfig(cfg *UserConfig, overwrite bool) error
	SwitchUser(un string) error
	SetDeviceID(*DeviceID) error
	SetStringAtPath(string, string) error
	SetBoolAtPath(string, bool) error
	SetIntAtPath(string, int) error
	SetNullAtPath(string) error
	DeleteAtPath(string)
	Reset()
	Write() error
}

type HttpRequest interface {
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

type ApiArg struct {
	Endpoint    string
	uArgs       url.Values
	Args        HttpArgs
	NeedSession bool
	HttpStatus  []int
	AppStatus   []string
	DecodeTo    interface{}
}

type ApiRes struct {
	Status     *jsonw.Wrapper
	Body       *jsonw.Wrapper
	HttpStatus int
	AppStatus  string
}

type ExternalHtmlRes struct {
	HttpStatus int
	GoQuery    *goquery.Document
}

type ExternalTextRes struct {
	HttpStatus int
	Body       string
}

type ExternalApiRes struct {
	HttpStatus int
	Body       *jsonw.Wrapper
}

type API interface {
	Get(ApiArg) (*ApiRes, error)
	GetResp(ApiArg) (*http.Response, error)
	GetDecode(ApiArg, interface{}) error
	Post(ApiArg) (*ApiRes, error)
	PostResp(ApiArg) (*http.Response, error)
	PostDecode(ApiArg, interface{}) error
}

type ExternalAPI interface {
	Get(ApiArg) (*ExternalApiRes, error)
	Post(ApiArg) (*ExternalApiRes, error)
	GetHtml(ApiArg) (*ExternalHtmlRes, error)
	GetText(ApiArg) (*ExternalTextRes, error)
	PostHtml(ApiArg) (*ExternalHtmlRes, error)
}

type IdentifyUI interface {
	Start(string)
	FinishWebProofCheck(keybase_1.RemoteProof, keybase_1.LinkCheckResult)
	FinishSocialProofCheck(keybase_1.RemoteProof, keybase_1.LinkCheckResult)
	FinishAndPrompt(*keybase_1.IdentifyOutcome) (keybase_1.FinishAndPromptRes, error)
	DisplayCryptocurrency(keybase_1.Cryptocurrency)
	DisplayKey(keybase_1.FOKID, *keybase_1.TrackDiff)
	ReportLastTrack(*keybase_1.TrackSummary)
	LaunchNetworkChecks(*keybase_1.Identity, *keybase_1.User)
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
}

type LoginUI interface {
	keybase_1.LoginUiInterface
}

type ProveUI interface {
	PromptOverwrite(string, keybase_1.PromptOverwriteType) (bool, error)
	PromptUsername(prompt string, prevError error) (string, error)
	OutputPrechecks(keybase_1.Text)
	PreProofWarning(keybase_1.Text) (bool, error)
	OutputInstructions(instructions keybase_1.Text, proof string) error
	OkToCheck(name string, attempt int) (bool, error)
	DisplayRecheckWarning(keybase_1.Text)
}

type SecretUI interface {
	GetSecret(pinentry keybase_1.SecretEntryArg, terminal *keybase_1.SecretEntryArg) (*keybase_1.SecretEntryRes, error)
	GetNewPassphrase(keybase_1.GetNewPassphraseArg) (string, error)
	GetKeybasePassphrase(keybase_1.GetKeybasePassphraseArg) (string, error)
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
	keybase_1.LocksmithUiInterface
}

type GPGUI interface {
	keybase_1.GpgUiInterface
}

type DoctorUI interface {
	LoginSelect(currentUser string, otherUsers []string) (string, error)
	DisplayStatus(status keybase_1.DoctorStatus) (bool, error)
	DisplayResult(msg string) error
}

type UI interface {
	GetDoctorUI() DoctorUI
	GetIdentifyUI() IdentifyUI
	GetIdentifyTrackUI(strict bool) IdentifyUI
	GetIdentifyLubaUI() IdentifyUI
	GetLoginUI() LoginUI
	GetSecretUI() SecretUI
	GetProveUI() ProveUI
	GetLogUI() LogUI
	GetGPGUI() GPGUI
	GetLocksmithUI() LocksmithUI
	Prompt(string, bool, Checker) (string, error)
	Configure() error
	Shutdown() error
}

type UIConsumer interface {
	Name() string
	RequiredUIs() []UIKind
	SubConsumers() []UIConsumer
}
