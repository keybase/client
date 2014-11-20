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
	"github.com/PuerkitoBio/goquery"
	"github.com/keybase/go-jsonw"
	"net/url"
)

type CommandLine interface {
	GetHome() string
	GetServerUri() string
	GetConfigFilename() string
	GetSessionFilename() string
	GetDbFilename() string
	GetDebug() (bool, bool)
	GetUsername() string
	GetUid() *UID
	GetProxy() string
	GetPlainLogging() (bool, bool)
	GetPgpDir() string
	GetEmail() string
	GetApiDump() (bool, bool)
	GetUserCacheSize() (int, bool)
	GetProofCacheSize() (int, bool)
	GetMerkleKeyFingerprints() []string
	GetPinentry() string
	GetGpg() string
	GetGpgOptions() []string
	GetPgpFingerprint() *PgpFingerprint
	GetSecretKeyring() string
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
	GetUsername() string
	GetUid() *UID
	GetProxy() string
	GetPlainLogging() (bool, bool)
	GetPgpDir() string
	GetBundledCA(host string) string
	GetEmail() string
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
	GetPgpFingerprint() *PgpFingerprint
	GetSecretKeyring() string
	GetSalt() []byte
}

type ConfigWriter interface {
	SetUsername(string)
	SetUid(UID)
	SetPgpFingerprint(*PgpFingerprint)
	SetSalt([]byte)
	SetStringAtPath(string, string) error
	SetBoolAtPath(string, bool) error
	SetIntAtPath(string, int) error
	SetNullAtPath(string) error
	DeleteAtPath(string)
	Reset()
	Write() error
}

type SessionWriter interface {
	SetLoggedIn(LoggedInResult)
	Write() error
}

type HttpRequest interface {
	SetEnvironment(env Env)
}

type ProofCheckers interface {
}

type SecretEntryArg struct {
	Desc   string
	Prompt string
	Error  string
	Cancel string
	OK     string
}

// Eventually we'll learn how to set checkboxes like GPG2 does on
// OSX. But for now, just the string...
type SecretEntryRes struct {
	Text     string
	Canceled bool
}

type Usage struct {
	Config     bool
	GpgKeyring bool
	KbKeyring  bool
	API        bool
	Terminal   bool
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
	Post(ApiArg) (*ApiRes, error)
}

type ExternalAPI interface {
	Get(ApiArg) (*ExternalApiRes, error)
	Post(ApiArg) (*ExternalApiRes, error)
	GetHtml(ApiArg) (*ExternalHtmlRes, error)
	GetText(ApiArg) (*ExternalTextRes, error)
	PostHtml(ApiArg) (*ExternalHtmlRes, error)
}

// A minimal access to the GPG client.
type GpgClient interface {
	Configure() (bool, error)                                        // bool = Whether the error is fatal or not
	Import(k PgpKeyBundle) error                                     // Import a key into the GPG keyring
	Index(secret bool, query string) (*GpgKeyIndex, error, Warnings) // Index the keychain
	ExportSecretKey(fp PgpFingerprint) (*PgpKeyBundle, error)
}

type IdentifyUI interface {
	ReportHook(string)
	ShowWarnings(Warnings)
	PromptForConfirmation(string) error
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

type UI interface {
	GetIdentifyUI() IdentifyUI
	Prompt(string, bool, Checker) (string, error)
	PromptForNewPassphrase(PromptArg) (string, error)
	PromptForKeybasePassphrase(string) (string, error)
	GetSecret([]SecretEntryArg) (*SecretEntryRes, error)
	Configure() error
	Shutdown() error
}
