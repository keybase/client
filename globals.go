//
// globals
//
//   All of the global objects in the libkb namespace that are shared
//   and mutated across various source files are here.  They are
//   accessed like `G.Session` or `G.LoginState`.  They're kept
//   under the `G` namespace to better keep track of them all.
//
//   The globals are built up gradually as the process comes up.
//   At first, we only have a logger, but eventually we add
//   command-line flags, configuration and environment, and accordingly,
//   might actually go back and change the Logger.

package libkb

import (
	"fmt"
	"io"
	"os"
	"runtime"
)

type ShutdownHook func() error

type Global struct {
	Log           *Logger        // Handles all logging
	Session       *Session       // The user's session cookie, &c
	SessionWriter SessionWriter  // To write the session back out
	LoginState    *LoginState    // What phase of login the user's in
	Env           *Env           // Env variables, cmdline args & config
	Keyrings      *Keyrings      // Gpg Keychains holding keys
	API           API            // How to make a REST call to the server
	Terminal      Terminal       // For prompting for passwords and input
	UserCache     *UserCache     // LRU cache of users in memory
	LocalDb       *JsonLocalDb   // Local DB for cache
	MerkleClient  *MerkleClient  // client for querying server's merkle sig tree
	XAPI          ExternalAPI    // for contacting Twitter, Github, etc.
	Output        io.Writer      // where 'Stdout'-style output goes
	ProofCache    *ProofCache    // where to cache proof results
	SecretEntry   *SecretEntry   // a terminal-or-pinentry system
	GpgClient     GpgClient      // A standard GPG-client (optional)
	ShutdownHooks []ShutdownHook // on shutdown, fire these...
}

var G Global = Global{
	Log:           NewDefaultLogger(),
	ShutdownHooks: make([]ShutdownHook, 0, 0),
}

func (g *Global) SetCommandLine(cmd CommandLine) { g.Env.SetCommandLine(cmd) }

func (g *Global) Init() {
	g.Env = NewEnv(nil, nil)
	g.LoginState = NewLoginState()
	g.Session = NewSession()
	g.SessionWriter = g.Session
}

func (g *Global) ConfigureLogging() error {
	g.Log.Configure(g.Env)
	g.Output = os.Stdout
	return nil
}

func (g *Global) PushShutdownHook(sh ShutdownHook) {
	g.ShutdownHooks = append(g.ShutdownHooks, sh)
}

func (g *Global) ConfigureConfig() error {
	c := NewJsonConfigFile(g.Env.GetConfigFilename())
	err := c.Load(true)
	if err != nil {
		return fmt.Errorf("Failed to open config file: %s\n", err.Error())
	}
	g.Env.SetConfig(*c)
	g.Env.SetConfigWriter(c)
	g.PushShutdownHook(func() error {
		return c.Write()
	})
	return nil
}

func (g *Global) ConfigureKeyring() error {
	c := NewKeyrings(*g.Env)
	err := c.Load()
	if err != nil {
		return fmt.Errorf("Failed to configure keyrings: %s", err.Error())
	}
	g.Keyrings = c
	return nil
}

func VersionMessage(linefn func(string)) {
	linefn(fmt.Sprintf("Keybase Command-Line App v%s", CLIENT_VERSION))
	linefn(fmt.Sprintf("- Built with %s", runtime.Version()))
	linefn("- Visit https://keybase.io for more details")
}

func (g Global) StartupMessage() {
	VersionMessage(func(s string) { g.Log.Debug(s) })
}

func (g *Global) ConfigureAPI() error {
	iapi, xapi, err := NewApiEngines(*g.Env)
	if err != nil {
		return fmt.Errorf("Failed to configure API access: %s", err.Error())
	}
	g.API = iapi
	g.XAPI = xapi
	return nil
}

func (g *Global) ConfigureTerminal() error {
	g.Terminal = NewTerminalImplementation()
	return nil
}

func (g *Global) ConfigureCaches() (err error) {
	g.UserCache, err = NewUserCache(g.Env.GetUserCacheSize())

	if err == nil {
		g.ProofCache, err = NewProofCache(g.Env.GetProofCacheSize())
	}

	// We consider the local DB as a cache; it's caching our
	// fetches from the server after all (and also our cryptographic
	// checking).
	if err == nil {
		g.LocalDb = NewJsonLocalDb(NewLevelDb())
		err = g.LocalDb.Open()
	}
	return
}

func (g *Global) ConfigureMerkleClient() error {
	g.MerkleClient = NewMerkleClient()
	return nil
}

func (g *Global) Shutdown() error {
	var err error
	if g.Terminal != nil {
		tmp := g.Terminal.Shutdown()
		if tmp != nil && err == nil {
			err = tmp
		}
	}
	if g.LocalDb != nil {
		tmp := g.LocalDb.Close()
		if tmp != nil && err == nil {
			err = tmp
		}
	}
	for _, hook := range g.ShutdownHooks {
		tmp := hook()
		if tmp != nil && err == nil {
			err = tmp
		}
	}
	return err
}

func (g *Global) ConfigureSecretEntry() (err error) {
	g.SecretEntry = NewSecretEntry()
	return nil
}

func (g *Global) ConfigureAll(line CommandLine, cmd Command) error {
	var err error

	g.SetCommandLine(line)

	g.ConfigureLogging()
	if cmd.UseConfig() {
		if err = g.ConfigureConfig(); err != nil {
			return err
		}
	}
	if cmd.UseKeyring() {
		if err = g.ConfigureKeyring(); err != nil {
			return err
		}
	}
	if cmd.UseAPI() {
		if err = g.ConfigureAPI(); err != nil {
			return err
		}
	}
	if cmd.UseTerminal() {
		if err = g.ConfigureTerminal(); err != nil {
			return err
		}
		// Assume for now that terminal -> secretentry
		if err = g.ConfigureSecretEntry(); err != nil {
			return err
		}
	}
	if err = g.ConfigureCaches(); err != nil {
		return err
	}

	if err = g.ConfigureMerkleClient(); err != nil {
		return err
	}

	G.StartupMessage()
	return nil
}

func (g *Global) OutputString(s string) {
	g.Output.Write([]byte(s))
}

func (g *Global) OutputBytes(b []byte) {
	g.Output.Write(b)
}

func (g *Global) GetGpgClient() GpgClient {
	if g.GpgClient == nil {
		g.GpgClient = NewGpgCLI()
	}
	return g.GpgClient
}
