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

type GlobalContext struct {
	Log           *Logger          // Handles all logging
	Session       *Session         // The user's session cookie, &c
	SessionWriter SessionWriter    // To write the session back out
	LoginState    *LoginState      // What phase of login the user's in
	Env           *Env             // Env variables, cmdline args & config
	Keyrings      *Keyrings        // Gpg Keychains holding keys
	API           API              // How to make a REST call to the server
	UserCache     *UserCache       // LRU cache of users in memory
	LocalDb       *JsonLocalDb     // Local DB for cache
	MerkleClient  *MerkleClient    // client for querying server's merkle sig tree
	XAPI          ExternalAPI      // for contacting Twitter, Github, etc.
	Output        io.Writer        // where 'Stdout'-style output goes
	ProofCache    *ProofCache      // where to cache proof results
	GpgClient     *GpgCLI          // A standard GPG-client (optional)
	ShutdownHooks []ShutdownHook   // on shutdown, fire these...
	SocketInfo    SocketInfo       // which socket to bind/connect to
	SocketWrapper *SocketWrapper   // only need one connection per
	SecretSyncer  *SecretSyncer    // For syncing secrets between the server and client
	XStreams      *ExportedStreams // a table of streams we've exported to the daemon (or vice-versa)
	UI            UI               // Interact with the UI
	Daemon        bool             // whether we're in daemon mode
	shutdown      bool             // whether we've shut down or not
}

func NewGlobalContext() GlobalContext {
	return GlobalContext{
		Log:           NewDefaultLogger(),
		ShutdownHooks: make([]ShutdownHook, 0, 0),
	}
}

var G GlobalContext = NewGlobalContext()

func init() {
	G = NewGlobalContext()
}

func (g *GlobalContext) SetCommandLine(cmd CommandLine) { g.Env.SetCommandLine(cmd) }

func (g *GlobalContext) SetUI(u UI) { g.UI = u }

func (g *GlobalContext) Init() {
	g.Env = NewEnv(nil, nil)
	g.LoginState = NewLoginState()
	g.Session = NewSession(g)
	g.SessionWriter = g.Session
	g.Daemon = false
}

func (g *GlobalContext) ConfigureLogging() error {
	g.Log.Configure(g.Env)
	g.Output = os.Stdout
	return nil
}

func (g *GlobalContext) PushShutdownHook(sh ShutdownHook) {
	g.ShutdownHooks = append(g.ShutdownHooks, sh)
}

func (g *GlobalContext) ConfigureConfig() error {
	c := NewJsonConfigFile(g.Env.GetConfigFilename())
	err := c.Load(true)
	if err != nil {
		return err
	}
	g.Env.SetConfig(*c)
	g.Env.SetConfigWriter(c)
	g.PushShutdownHook(func() error {
		return c.Write()
	})
	return nil
}

func (g *GlobalContext) ConfigureKeyring(usage Usage) error {
	c := NewKeyrings(g, usage)
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

func (g GlobalContext) StartupMessage() {
	VersionMessage(func(s string) { g.Log.Debug(s) })
}

func (g *GlobalContext) ConfigureAPI() error {
	iapi, xapi, err := NewApiEngines(*g.Env)
	if err != nil {
		return fmt.Errorf("Failed to configure API access: %s", err.Error())
	}
	g.API = iapi
	g.XAPI = xapi
	return nil
}

func (g *GlobalContext) ConfigureCaches() (err error) {
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

func (g *GlobalContext) ConfigureMerkleClient() error {
	g.MerkleClient = NewMerkleClient(g)
	return nil
}

func (g *GlobalContext) ConfigureSecretSyncer() error {
	g.SecretSyncer = &SecretSyncer{Contextified: Contextified{g}}
	return nil
}

func (g *GlobalContext) ConfigureExportedStreams() error {
	g.XStreams = NewExportedStreams()
	return nil
}

func (g *GlobalContext) Shutdown() error {
	if g.shutdown {
		return nil
	}

	epick := FirstErrorPicker{}

	if g.UI != nil {
		epick.Push(g.UI.Shutdown())
	}
	if g.LocalDb != nil {
		epick.Push(g.LocalDb.Close())
	}
	if g.SessionWriter != nil {
		epick.Push(g.SessionWriter.Write())
	}

	for _, hook := range g.ShutdownHooks {
		epick.Push(hook())
	}
	g.shutdown = true
	return epick.Error()
}

func (u Usage) UseKeyring() bool {
	return u.KbKeyring || u.GpgKeyring
}

func (g *GlobalContext) ConfigureAll(line CommandLine, cmd Command) error {
	var err error

	g.SetCommandLine(line)

	g.ConfigureLogging()

	usage := cmd.GetUsage()

	if usage.Config {
		if err = g.ConfigureConfig(); err != nil {
			return err
		}
	}
	if usage.UseKeyring() {
		if err = g.ConfigureKeyring(usage); err != nil {
			return err
		}
	}
	if usage.API {
		if err = g.ConfigureAPI(); err != nil {
			return err
		}
	}
	if usage.Socket || !G.Env.GetStandalone() {
		if err = g.ConfigureSocketInfo(); err != nil {
			return err
		}
	}

	if err = g.ConfigureSecretSyncer(); err != nil {
		return err
	}

	if err = g.ConfigureExportedStreams(); err != nil {
		return err
	}

	if err = g.ConfigureCaches(); err != nil {
		return err
	}

	if err = g.ConfigureMerkleClient(); err != nil {
		return err
	}
	if g.UI != nil {
		if err = g.UI.Configure(); err != nil {
			return err
		}
	}

	G.StartupMessage()
	return nil
}

func (g *GlobalContext) OutputString(s string) {
	g.Output.Write([]byte(s))
}

func (g *GlobalContext) OutputBytes(b []byte) {
	g.Output.Write(b)
}

func (g *GlobalContext) GetGpgClient() *GpgCLI {
	if g.GpgClient == nil {
		g.GpgClient = NewGpgCLI()
	}
	return g.GpgClient
}

func (g *GlobalContext) GetMyUID() (ret *UID) {
	ret = g.Session.GetUID()
	if ret == nil {
		ret = g.Env.GetUID()
	}
	return ret
}

func (g *GlobalContext) ConfigureSocketInfo() (err error) {
	g.SocketInfo, err = ConfigureSocketInfo()
	return err
}

// Contextified objects have explicit references to the GlobalContext,
// so that G can be swapped out for something else.  We're going to incrementally
// start moving objects over to this system.
type Contextified struct {
	g *GlobalContext
}

func (c Contextified) G() *GlobalContext {
	if c.g != nil {
		return c.g
	} else {
		return &G
	}
}

func (c *Contextified) SetGlobalContext(g *GlobalContext) { c.g = g }

func NewContextified(gc *GlobalContext) Contextified {
	return Contextified{g: gc}
}

type Contexitifier interface {
	G() *GlobalContext
}
