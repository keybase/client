package libkb

/*
 * Interfaces
 *
 *   Here are the interfaces that we're going to assume when
 *   implementing the features of command-line clients or
 *   servers.  Depending on the conext, we might get different
 *   instantiations of these interfaces.
 */

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
}

type Server interface {
}

type LocalCache interface {
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
}

type ConfigWriter interface {
	SetUsername(string)
	SetUid(string)
	SetSalt(string)
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

type Keychain interface {
}

type ProofCheckers interface {
}

type Pinentry interface {
}

type Command interface {
	Run() error
	UseConfig() bool
	UseKeyring() bool
	UseAPI() bool
	UseTerminal() bool
}

type Terminal interface {
	Startup() error
	Init() error
	Shutdown() error
	PromptPassword(string) (string, error)
	Write(string) error
	Prompt(string) (string, error)
}
