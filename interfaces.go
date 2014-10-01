
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
	GetApiUriPathPrefix() string
	GetUsername() string
	GetProxy() string
	GetPlainLogging() (bool, bool)
}

type Server interface {

}

type LocalCache interface {

}

type Config interface {
	GetHome() string
	GetServerUri() string
	GetConfigFilename() string
	GetSessionFilename() string
	GetDbFilename() string
	GetDebug() (bool, bool)
	GetApiUriPathPrefix() string
	GetUsername() string
	GetProxy() string
	GetPlainLogging() (bool, bool)
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
}
