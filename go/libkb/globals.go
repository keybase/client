//
// globals
//
//   All of the global objects in the libkb namespace that are shared
//   and mutated across various source files are here.  They are
//   accessed like `G.Log` or `G.Env`.  They're kept
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
	"sync"

	"github.com/keybase/client/go/cache/favcache"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/protocol/go"
)

type ShutdownHook func() error

type GlobalContext struct {
	Log              *logger.Logger  // Handles all logging
	Env              *Env            // Env variables, cmdline args & config
	Keyrings         *Keyrings       // Gpg Keychains holding keys
	API              API             // How to make a REST call to the server
	ResolveCache     *ResolveCache   // cache of resolve results
	LocalDb          *JSONLocalDb    // Local DB for cache
	MerkleClient     *MerkleClient   // client for querying server's merkle sig tree
	XAPI             ExternalAPI     // for contacting Twitter, Github, etc.
	Output           io.Writer       // where 'Stdout'-style output goes
	ProofCache       *ProofCache     // where to cache proof results
	FavoriteCache    *favcache.Cache // where to cache favorite folders
	GpgClient        *GpgCLI         // A standard GPG-client (optional)
	ShutdownHooks    []ShutdownHook  // on shutdown, fire these...
	SocketInfo       SocketInfo      // which socket to bind/connect to
	socketWrapperMu  sync.RWMutex
	SocketWrapper    *SocketWrapper    // only need one connection per
	LoopbackListener *LoopbackListener // If we're in loopback mode, we'll connect through here
	XStreams         *ExportedStreams  // a table of streams we've exported to the daemon (or vice-versa)
	Timers           *TimerSet         // Which timers are currently configured on
	IdentifyCache    *IdentifyCache    // cache of IdentifyOutcomes
	UI               UI                // Interact with the UI
	Service          bool              // whether we're in server mode
	shutdown         bool              // whether we've shut down or not
	loginStateMu     sync.RWMutex      // protects loginState pointer, which gets destroyed on logout
	loginState       *LoginState       // What phase of login the user's in
}

func NewGlobalContext() *GlobalContext {
	return &GlobalContext{
		Log: logger.New(),
	}
}

var G *GlobalContext

func init() {
	G = NewGlobalContext()
}

func (g *GlobalContext) SetCommandLine(cmd CommandLine) { g.Env.SetCommandLine(cmd) }

func (g *GlobalContext) SetUI(u UI) { g.UI = u }

func (g *GlobalContext) Init() {
	g.Env = NewEnv(nil, nil)
	g.Service = false
	g.loginStateMu.Lock()
	defer g.loginStateMu.Unlock()
	g.createLoginStateLocked()
}

// requires lock on loginStateMu before calling
func (g *GlobalContext) createLoginStateLocked() {
	g.loginState = NewLoginState(g)
}

func (g *GlobalContext) LoginState() *LoginState {
	g.loginStateMu.RLock()
	defer g.loginStateMu.RUnlock()

	return g.loginState
}

func (g *GlobalContext) Logout() error {
	g.loginStateMu.Lock()
	defer g.loginStateMu.Unlock()
	if err := g.loginState.Logout(); err != nil {
		return err
	}

	g.IdentifyCache = NewIdentifyCache()
	g.FavoriteCache = favcache.New()

	// get a clean LoginState:
	g.createLoginStateLocked()

	return nil
}

func (g *GlobalContext) ConfigureLogging() error {
	g.Log.Configure(g.Env.GetLogFormat(), g.Env.GetDebug(), g.Env.GetLogFile())
	g.Output = os.Stdout
	return nil
}

func (g *GlobalContext) PushShutdownHook(sh ShutdownHook) {
	g.ShutdownHooks = append(g.ShutdownHooks, sh)
}

func (g *GlobalContext) ConfigureConfig() error {
	c := NewJSONConfigFile(g.Env.GetConfigFilename())
	err := c.Load(false)
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

func (g *GlobalContext) ConfigureTimers() error {
	g.Timers = NewTimerSet(g)
	return nil
}

func (g *GlobalContext) ConfigureKeyring() error {
	g.Keyrings = NewKeyrings(g)
	return nil
}

func VersionMessage(linefn func(string)) {
	linefn(fmt.Sprintf("Keybase Command-Line App v%s", Version))
	linefn(fmt.Sprintf("- Built with %s", runtime.Version()))
	linefn("- Visit https://keybase.io for more details")
}

func (g *GlobalContext) StartupMessage() {
	VersionMessage(func(s string) { g.Log.Debug(s) })
}

func (g *GlobalContext) ConfigureAPI() error {
	iapi, xapi, err := NewAPIEngines(g.Env)
	if err != nil {
		return fmt.Errorf("Failed to configure API access: %s", err)
	}
	g.API = iapi
	g.XAPI = xapi
	return nil
}

func (g *GlobalContext) ConfigureCaches() error {
	g.ResolveCache = NewResolveCache()
	g.IdentifyCache = NewIdentifyCache()
	g.ProofCache = NewProofCache(g.Env.GetProofCacheSize())
	g.FavoriteCache = favcache.New()

	// We consider the local DB as a cache; it's caching our
	// fetches from the server after all (and also our cryptographic
	// checking).
	g.LocalDb = NewJSONLocalDb(NewLevelDb())
	return g.LocalDb.Open()
}

func (g *GlobalContext) ConfigureMerkleClient() error {
	g.MerkleClient = NewMerkleClient(g)
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
	if g.LoginState() != nil {
		epick.Push(g.LoginState().Shutdown())
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
		if err = g.ConfigureKeyring(); err != nil {
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

	if err = g.ConfigureTimers(); err != nil {
		return err
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
		g.GpgClient = NewGpgCLI(GpgCLIArg{})
	}
	return g.GpgClient
}

func (g *GlobalContext) GetMyUID() keybase1.UID {
	var uid keybase1.UID

	g.LoginState().LocalSession(func(s *Session) {
		uid = s.GetUID()
	}, "G - GetMyUID - GetUID")
	if uid.Exists() {
		return uid
	}

	return g.Env.GetUID()
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
	}
	return G
}

func (c *Contextified) SetGlobalContext(g *GlobalContext) { c.g = g }

func NewContextified(gc *GlobalContext) Contextified {
	return Contextified{g: gc}
}

type Contexitifier interface {
	G() *GlobalContext
}
