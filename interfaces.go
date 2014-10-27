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
	"github.com/codegangsta/cli"
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
	GetProxy() string
	GetPlainLogging() (bool, bool)
	GetPgpDir() string
	GetEmail() string
	GetApiDump() (bool, bool)
	GetUserCacheSize() (int, bool)
	GetMerkleKeyFingerprints() []string
	GetPinentry() string
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
	GetMerkleKeyFingerprints() []string
	GetPinentry() string
	GetNoPinentry() (bool, bool)
}

type ConfigWriter interface {
	SetUsername(string)
	SetUid(string)
	SetSalt(string)
	SetStringAtPath(string, string) error
	SetBoolAtPath(string, bool) error
	SetIntAtPath(string, int) error
	SetNullAtPath(string) error
	DeleteAtPath(string)
	Reset()
	Write() error
}

type SessionWriter interface {
	SetSession(string)
	SetCsrf(string)
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

type SecretEntryInterface interface {
	Get(SecretEntryArg, *SecretEntryArg) (*SecretEntryRes, error)
}

type Command interface {
	Run() error
	UseConfig() bool
	UseKeyring() bool
	UseAPI() bool
	UseTerminal() bool
	Initialize(ctx *cli.Context) error
}

type Terminal interface {
	Startup() error
	Init() error
	Shutdown() error
	PromptPassword(string) (string, error)
	Write(string) error
	Prompt(string) (string, error)
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
	PostHtml(ApiArg) (*ExternalHtmlRes, error)
}
