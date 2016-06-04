// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

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

	"github.com/jonboulle/clockwork"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
)

type ShutdownHook func() error

type LoginHook interface {
	OnLogin() error
}

type LogoutHook interface {
	OnLogout() error
}

type GlobalContext struct {
	Log               logger.Logger  // Handles all logging
	VDL               *VDebugLog     // verbose debug log
	Env               *Env           // Env variables, cmdline args & config
	Keyrings          *Keyrings      // Gpg Keychains holding keys
	API               API            // How to make a REST call to the server
	Resolver          *Resolver      // cache of resolve results
	LocalDb           *JSONLocalDb   // Local DB for cache
	MerkleClient      *MerkleClient  // client for querying server's merkle sig tree
	XAPI              ExternalAPI    // for contacting Twitter, Github, etc.
	Output            io.Writer      // where 'Stdout'-style output goes
	ProofCache        *ProofCache    // where to cache proof results
	GpgClient         *GpgCLI        // A standard GPG-client (optional)
	ShutdownHooks     []ShutdownHook // on shutdown, fire these...
	SocketInfo        Socket         // which socket to bind/connect to
	socketWrapperMu   sync.RWMutex
	SocketWrapper     *SocketWrapper     // only need one connection per
	LoopbackListener  *LoopbackListener  // If we're in loopback mode, we'll connect through here
	XStreams          *ExportedStreams   // a table of streams we've exported to the daemon (or vice-versa)
	Timers            *TimerSet          // Which timers are currently configured on
	TrackCache        *TrackCache        // cache of IdentifyOutcomes for tracking purposes
	Identify2Cache    Identify2Cacher    // cache of Identify2 results for fast-pathing identify2 RPCS
	LinkCache         *LinkCache         // cache of ChainLinks
	UI                UI                 // Interact with the UI
	Service           bool               // whether we're in server mode
	shutdownOnce      sync.Once          // whether we've shut down or not
	loginStateMu      sync.RWMutex       // protects loginState pointer, which gets destroyed on logout
	loginState        *LoginState        // What phase of login the user's in
	ConnectionManager *ConnectionManager // keep tabs on all active client connections
	NotifyRouter      *NotifyRouter      // How to route notifications
	// How to route UIs. Nil if we're in standalone mode or in
	// tests, and non-nil in service mode.
	UIRouter            UIRouter            // How to route UIs
	ProofCheckerFactory ProofCheckerFactory // Makes new ProofCheckers
	ExitCode            keybase1.ExitCode   // Value to return to OS on Exit()
	RateLimits          *RateLimits         // tracks the last time certain actions were taken
	Clock               clockwork.Clock     // RealClock unless we're testing
	SecretStoreAll      SecretStoreAll      // nil except for tests and supported platforms
	hookMu              sync.RWMutex        // protects loginHooks, logoutHooks
	loginHooks          []LoginHook         // call these on login
	logoutHooks         []LogoutHook        // call these on logout
	GregorDismisser     GregorDismisser     // for dismissing gregor items that we've handled
	GregorListener      GregorListener      // for alerting about clients connecting and registering UI protocols
}

func NewGlobalContext() *GlobalContext {
	log := logger.New("keybase")
	return &GlobalContext{
		Log:                 log,
		VDL:                 NewVDebugLog(log),
		ProofCheckerFactory: defaultProofCheckerFactory,
		Clock:               clockwork.NewRealClock(),
	}
}

var G *GlobalContext

func init() {
	G = NewGlobalContext()
}

func (g *GlobalContext) SetCommandLine(cmd CommandLine) { g.Env.SetCommandLine(cmd) }

func (g *GlobalContext) SetUI(u UI) { g.UI = u }

func (g *GlobalContext) Init() *GlobalContext {
	g.Env = NewEnv(nil, nil)
	g.Service = false
	g.createLoginState()
	g.Resolver = NewResolver(g)
	g.RateLimits = NewRateLimits(g)
	g.SecretStoreAll = NewSecretStoreAll(g)
	return g
}

func NewGlobalContextInit() *GlobalContext {
	return NewGlobalContext().Init()
}

func (g *GlobalContext) SetService() {
	g.Service = true
	g.ConnectionManager = NewConnectionManager()
	g.NotifyRouter = NewNotifyRouter(g)
}

func (g *GlobalContext) SetUIRouter(u UIRouter) {
	g.UIRouter = u
}

// requires lock on loginStateMu before calling
func (g *GlobalContext) createLoginStateLocked() {
	if g.loginState != nil {
		g.loginState.Shutdown()
	}
	g.loginState = NewLoginState(g)
}

func (g *GlobalContext) createLoginState() {
	if g.loginState != nil {
		g.loginState.Shutdown()
	}
	g.loginState = NewLoginState(g)
}

func (g *GlobalContext) LoginState() *LoginState {
	g.loginStateMu.RLock()
	defer g.loginStateMu.RUnlock()

	return g.loginState
}

// ResetLoginState is mainly used for testing...
func (g *GlobalContext) ResetLoginState() {
	g.createLoginStateLocked()
}

func (g *GlobalContext) Logout() error {
	g.loginStateMu.Lock()
	defer g.loginStateMu.Unlock()
	if err := g.loginState.Logout(); err != nil {
		return err
	}

	g.CallLogoutHooks()

	if g.TrackCache != nil {
		g.TrackCache.Shutdown()
	}
	if g.Identify2Cache != nil {
		g.Identify2Cache.Shutdown()
	}
	g.TrackCache = NewTrackCache()
	g.Identify2Cache = NewIdentify2Cache(g.Env.GetUserCacheMaxAge())

	// get a clean LoginState:
	g.createLoginStateLocked()

	return nil
}

func (g *GlobalContext) ConfigureLogging() error {
	style := g.Env.GetLogFormat()
	debug := g.Env.GetDebug()
	logFile := g.Env.GetLogFile()
	if logFile == "" {
		g.Log.Configure(style, debug, g.Env.GetDefaultLogFile())
	} else {
		g.Log.Configure(style, debug, logFile)
		g.Log.RotateLogFile()
	}
	g.Output = os.Stdout
	g.VDL.Configure(g.Env.GetVDebugSetting())
	return nil
}

func (g *GlobalContext) PushShutdownHook(sh ShutdownHook) {
	g.ShutdownHooks = append(g.ShutdownHooks, sh)
}

func (g *GlobalContext) ConfigureConfig() error {
	c := NewJSONConfigFile(g, g.Env.GetConfigFilename())
	err := c.Load(false)
	if err != nil {
		return err
	}
	if err = c.Check(); err != nil {
		return err
	}
	g.Env.SetConfig(*c, c)
	return nil
}

func (g *GlobalContext) ConfigReload() error {
	err := g.ConfigureConfig()
	g.ConfigureUpdaterConfig()
	return err
}

func (g *GlobalContext) ConfigureUpdaterConfig() error {
	c := NewJSONUpdaterConfigFile(g)
	err := c.Load(false)
	if err == nil {
		g.Env.SetUpdaterConfig(*c)
	} else {
		g.Log.Debug("Failed to open update config: %s\n", err)
	}
	return err
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
	linefn(fmt.Sprintf("Keybase CLI %s", VersionString()))
	linefn(fmt.Sprintf("- Built with %s", runtime.Version()))
	linefn("- Visit https://keybase.io for more details")
}

func (g *GlobalContext) StartupMessage() {
	VersionMessage(func(s string) { g.Log.Debug(s) })
}

func (g *GlobalContext) ConfigureAPI() error {
	iapi, xapi, err := NewAPIEngines(g)
	if err != nil {
		return fmt.Errorf("Failed to configure API access: %s", err)
	}
	g.API = iapi
	g.XAPI = xapi
	return nil
}

func (g *GlobalContext) ConfigureCaches() error {
	g.Resolver.EnableCaching()
	g.TrackCache = NewTrackCache()
	g.Identify2Cache = NewIdentify2Cache(g.Env.GetUserCacheMaxAge())
	g.ProofCache = NewProofCache(g, g.Env.GetProofCacheSize())
	g.LinkCache = NewLinkCache(g.Env.GetLinkCacheSize(), g.Env.GetLinkCacheCleanDur())
	g.Log.Debug("Created LinkCache, max size: %d, clean dur: %s", g.Env.GetLinkCacheSize(), g.Env.GetLinkCacheCleanDur())

	// We consider the local DB as a cache; it's caching our
	// fetches from the server after all (and also our cryptographic
	// checking).
	g.LocalDb = NewJSONLocalDb(NewLevelDb(g))
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

// Shutdown is called exactly once per-process and does whatever
// cleanup is necessary to shut down the server.
func (g *GlobalContext) Shutdown() error {
	var err error
	didShutdown := false

	// Wrap in a Once.Do so that we don't inadvertedly
	// run this code twice.
	g.shutdownOnce.Do(func() {
		g.Log.Debug("Calling shutdown first time through")
		didShutdown = true

		epick := FirstErrorPicker{}

		if g.NotifyRouter != nil {
			g.NotifyRouter.Shutdown()
		}

		if g.UIRouter != nil {
			g.UIRouter.Shutdown()
		}

		if g.ConnectionManager != nil {
			g.ConnectionManager.Shutdown()
		}

		if g.UI != nil {
			epick.Push(g.UI.Shutdown())
		}
		if g.LocalDb != nil {
			epick.Push(g.LocalDb.Close())
		}
		if g.LoginState() != nil {
			epick.Push(g.LoginState().Shutdown())
		}

		if g.TrackCache != nil {
			g.TrackCache.Shutdown()
		}
		if g.Identify2Cache != nil {
			g.Identify2Cache.Shutdown()
		}
		if g.LinkCache != nil {
			g.LinkCache.Shutdown()
		}
		if g.Resolver != nil {
			g.Resolver.Shutdown()
		}

		for _, hook := range g.ShutdownHooks {
			epick.Push(hook())
		}

		err = epick.Error()

		g.Log.Debug("exiting shutdown code=%d; err=%v", g.ExitCode, err)
	})

	// Make a little bit of a statement if we wind up here a second time
	// (which is a bug).
	if !didShutdown {
		g.Log.Debug("Skipped shutdown on second call")
	}

	return err
}

func (u Usage) UseKeyring() bool {
	return u.KbKeyring || u.GpgKeyring
}

func (g *GlobalContext) ConfigureCommand(line CommandLine, cmd Command) error {
	usage := cmd.GetUsage()
	return g.Configure(line, usage)
}

func (g *GlobalContext) Configure(line CommandLine, usage Usage) error {
	g.SetCommandLine(line)
	err := g.ConfigureLogging()
	if err != nil {
		return err
	}
	return g.ConfigureUsage(usage)
}

func (g *GlobalContext) NewProofChecker(l RemoteProofChainLink) (ProofChecker, ProofError) {
	return g.ProofCheckerFactory.MakeProofChecker(l)
}

func (g *GlobalContext) ConfigureUsage(usage Usage) error {
	var err error

	if usage.Config {
		if err = g.ConfigReload(); err != nil {
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
	if usage.Socket || !g.Env.GetStandalone() {
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
		g.GpgClient = NewGpgCLI(g, nil)
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
	g.SocketInfo, err = NewSocket(g)
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

func (c Contextified) GStrict() *GlobalContext {
	return c.g
}

func (c *Contextified) SetGlobalContext(g *GlobalContext) { c.g = g }

func NewContextified(gc *GlobalContext) Contextified {
	return Contextified{g: gc}
}

type Contexitifier interface {
	G() *GlobalContext
}

func (g *GlobalContext) GetConfiguredAccounts() ([]keybase1.ConfiguredAccount, error) {
	return GetConfiguredAccounts(g, g.SecretStoreAll)
}

func (g *GlobalContext) GetAllUserNames() (NormalizedUsername, []NormalizedUsername, error) {
	return g.Env.GetConfig().GetAllUsernames()
}

func (g *GlobalContext) GetStoredSecretServiceName() string {
	return g.Env.GetStoredSecretServiceName()
}

func (g *GlobalContext) GetStoredSecretAccessGroup() string {
	return g.Env.GetStoredSecretAccessGroup()
}

func (g *GlobalContext) GetUsersWithStoredSecrets() ([]string, error) {
	if g.SecretStoreAll != nil {
		return g.SecretStoreAll.GetUsersWithStoredSecrets()
	}
	return []string{}, nil
}

func (g *GlobalContext) GetCacheDir() string {
	return g.Env.GetCacheDir()
}

func (g *GlobalContext) GetRuntimeDir() string {
	return g.Env.GetRuntimeDir()
}

func (g *GlobalContext) GetRunMode() RunMode {
	return g.Env.GetRunMode()
}

func (g *GlobalContext) GetClock() clockwork.Clock {
	if g.Clock == nil {
		return clockwork.NewRealClock()
	}
	return g.Clock
}

func (g *GlobalContext) GetMyClientDetails() keybase1.ClientDetails {
	return keybase1.ClientDetails{
		ClientType: keybase1.ClientType_CLI,
		Pid:        os.Getpid(),
		Argv:       os.Args,
		Version:    VersionString(),
	}
}

func (g *GlobalContext) GetUnforwardedLogger() *logger.UnforwardedLogger {
	if g.Log == nil {
		return nil
	}
	log, ok := g.Log.(*logger.Standard)
	if !ok {
		g.Log.Notice("Can't make Unforwarded logger from a non-standard logger")
		return nil
	}
	return (*logger.UnforwardedLogger)(log)
}

func (g *GlobalContext) GetLog() logger.Logger {
	return g.Log
}

func (g *GlobalContext) AddLoginHook(hook LoginHook) {
	g.hookMu.Lock()
	defer g.hookMu.Unlock()
	g.loginHooks = append(g.loginHooks, hook)
}

func (g *GlobalContext) CallLoginHooks() {
	g.hookMu.RLock()
	defer g.hookMu.RUnlock()
	for _, h := range g.loginHooks {
		if err := h.OnLogin(); err != nil {
			g.Log.Warning("OnLogin hook error: %s", err)
		}
	}
}

func (g *GlobalContext) AddLogoutHook(hook LogoutHook) {
	g.hookMu.Lock()
	defer g.hookMu.Unlock()
	g.logoutHooks = append(g.logoutHooks, hook)
}

func (g *GlobalContext) CallLogoutHooks() {
	g.hookMu.RLock()
	defer g.hookMu.RUnlock()
	for _, h := range g.logoutHooks {
		if err := h.OnLogout(); err != nil {
			g.Log.Warning("OnLogout hook error: %s", err)
		}
	}
}
