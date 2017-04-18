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
	"time"

	chattypes "github.com/keybase/client/go/chat/types"
	logger "github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	clockwork "github.com/keybase/clockwork"
	context "golang.org/x/net/context"
)

type ShutdownHook func() error

type LoginHook interface {
	OnLogin() error
}

type LogoutHook interface {
	OnLogout() error
}

type GlobalContext struct {
	Log               logger.Logger // Handles all logging
	VDL               *VDebugLog    // verbose debug log
	Env               *Env          // Env variables, cmdline args & config
	SKBKeyringMu      *sync.Mutex   // Protects all attempts to mutate the SKBKeyringFile
	Keyrings          *Keyrings     // Gpg Keychains holding keys
	sharedDHKeyringMu *sync.Mutex
	sharedDHKeyring   *SharedDHKeyring     // Keyring holding shared DH keypairs
	API               API                  // How to make a REST call to the server
	Resolver          *Resolver            // cache of resolve results
	LocalDb           *JSONLocalDb         // Local DB for cache
	LocalChatDb       *JSONLocalDb         // Local DB for cache
	MerkleClient      *MerkleClient        // client for querying server's merkle sig tree
	XAPI              ExternalAPI          // for contacting Twitter, Github, etc.
	Output            io.Writer            // where 'Stdout'-style output goes
	DNSNSFetcher      DNSNameServerFetcher // The mobile apps potentially pass an implementor of this interface which is used to grab currently configured DNS name servers

	cacheMu        *sync.RWMutex   // protects all caches
	ProofCache     *ProofCache     // where to cache proof results
	TrackCache     *TrackCache     // cache of IdentifyOutcomes for tracking purposes
	Identify2Cache Identify2Cacher // cache of Identify2 results for fast-pathing identify2 RPCS
	LinkCache      *LinkCache      // cache of ChainLinks
	upakLoader     UPAKLoader      // Load flat users with the ability to hit the cache
	CardCache      *UserCardCache  // cache of keybase1.UserCard objects
	fullSelfer     FullSelfer      // a loader that gets the full self object
	pvlSource      PvlSource       // a cache and fetcher for pvl

	GpgClient         *GpgCLI        // A standard GPG-client (optional)
	ShutdownHooks     []ShutdownHook // on shutdown, fire these...
	SocketInfo        Socket         // which socket to bind/connect to
	socketWrapperMu   *sync.RWMutex
	SocketWrapper     *SocketWrapper     // only need one connection per
	LoopbackListener  *LoopbackListener  // If we're in loopback mode, we'll connect through here
	XStreams          *ExportedStreams   // a table of streams we've exported to the daemon (or vice-versa)
	Timers            *TimerSet          // Which timers are currently configured on
	UI                UI                 // Interact with the UI
	Service           bool               // whether we're in server mode
	shutdownOnce      *sync.Once         // whether we've shut down or not
	loginStateMu      *sync.RWMutex      // protects loginState pointer, which gets destroyed on logout
	loginState        *LoginState        // What phase of login the user's in
	ConnectionManager *ConnectionManager // keep tabs on all active client connections
	NotifyRouter      *NotifyRouter      // How to route notifications
	// How to route UIs. Nil if we're in standalone mode or in
	// tests, and non-nil in service mode.
	UIRouter           UIRouter                  // How to route UIs
	Services           ExternalServicesCollector // All known external services
	ExitCode           keybase1.ExitCode         // Value to return to OS on Exit()
	RateLimits         *RateLimits               // tracks the last time certain actions were taken
	clockMu            *sync.Mutex               // protects Clock
	clock              clockwork.Clock           // RealClock unless we're testing
	SecretStoreAll     *SecretStoreLocked        // nil except for tests and supported platforms
	hookMu             *sync.RWMutex             // protects loginHooks, logoutHooks
	loginHooks         []LoginHook               // call these on login
	logoutHooks        []LogoutHook              // call these on logout
	GregorDismisser    GregorDismisser           // for dismissing gregor items that we've handled
	GregorListener     GregorListener            // for alerting about clients connecting and registering UI protocols
	oodiMu             *sync.RWMutex             // For manipluating the OutOfDateInfo
	outOfDateInfo      *keybase1.OutOfDateInfo   // Stores out of date messages we got from API server headers.
	lastUpgradeWarning *time.Time                // When the last upgrade was warned for (to reate-limit nagging)

	uchMu               *sync.Mutex          // protects the UserChangedHandler array
	UserChangedHandlers []UserChangedHandler // a list of handlers that deal generically with userchanged events
	ConnectivityMonitor ConnectivityMonitor  // Detect whether we're connected or not.

	// Chat globals
	InboxSource         chattypes.InboxSource         // source of remote inbox entries for chat
	ConvSource          chattypes.ConversationSource  // source of remote message bodies for chat
	MessageDeliverer    chattypes.MessageDeliverer    // background message delivery service
	ServerCacheVersions chattypes.ServerCacheVersions // server side versions for chat caches
	ChatSyncer          chattypes.Syncer              // For syncing inbox with server

	// Can be overloaded by tests to get an improvement in performance
	NewTriplesec func(pw []byte, salt []byte) (Triplesec, error)

	// Options specified for testing only
	TestOptions GlobalTestOptions

	ActiveDevice *ActiveDevice

	NetContext context.Context
}

type GlobalTestOptions struct {
	NoBug3964Repair bool
}

func (g *GlobalContext) GetLog() logger.Logger                         { return g.Log }
func (g *GlobalContext) GetVDebugLog() *VDebugLog                      { return g.VDL }
func (g *GlobalContext) GetAPI() API                                   { return g.API }
func (g *GlobalContext) GetExternalAPI() ExternalAPI                   { return g.XAPI }
func (g *GlobalContext) GetServerURI() string                          { return g.Env.GetServerURI() }
func (g *GlobalContext) GetMerkleClient() *MerkleClient                { return g.MerkleClient }
func (g *GlobalContext) GetNetContext() context.Context                { return g.NetContext }
func (g *GlobalContext) GetEnv() *Env                                  { return g.Env }
func (g *GlobalContext) GetDNSNameServerFetcher() DNSNameServerFetcher { return g.DNSNSFetcher }

func NewGlobalContext() *GlobalContext {
	log := logger.New("keybase")
	return &GlobalContext{
		Log:                log,
		VDL:                NewVDebugLog(log),
		SKBKeyringMu:       new(sync.Mutex),
		sharedDHKeyringMu:  new(sync.Mutex),
		cacheMu:            new(sync.RWMutex),
		socketWrapperMu:    new(sync.RWMutex),
		shutdownOnce:       new(sync.Once),
		loginStateMu:       new(sync.RWMutex),
		clockMu:            new(sync.Mutex),
		clock:              clockwork.NewRealClock(),
		hookMu:             new(sync.RWMutex),
		oodiMu:             new(sync.RWMutex),
		outOfDateInfo:      &keybase1.OutOfDateInfo{},
		lastUpgradeWarning: new(time.Time),
		uchMu:              new(sync.Mutex),
		NewTriplesec:       NewSecureTriplesec,
		ActiveDevice:       new(ActiveDevice),
		NetContext:         context.TODO(),
	}
}

func (g *GlobalContext) CloneWithNetContextAndNewLogger(netCtx context.Context) *GlobalContext {
	tmp := *g
	// For legacy code that doesn't thread contexts through to logging properly,
	// change the underlying logger.
	tmp.Log = logger.NewSingleContextLogger(netCtx, g.Log)
	tmp.NetContext = netCtx
	return &tmp
}

func (g *GlobalContext) CloneWithNetContext(netCtx context.Context) *GlobalContext {
	tmp := *g
	tmp.NetContext = netCtx
	return &tmp
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
	g.upakLoader = NewUncachedUPAKLoader(g)
	g.fullSelfer = NewUncachedFullSelf(g)
	g.ConnectivityMonitor = NullConnectivityMonitor{}
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

func (g *GlobalContext) SetDNSNameServerFetcher(d DNSNameServerFetcher) {
	g.DNSNSFetcher = d
}

// requires lock on loginStateMu before calling
func (g *GlobalContext) createLoginStateLocked() {
	if g.loginState != nil {
		g.loginState.Shutdown()
	}
	g.loginState = NewLoginState(g)
	g.ActiveDevice = new(ActiveDevice)
}

func (g *GlobalContext) createLoginState() {
	g.loginStateMu.Lock()
	defer g.loginStateMu.Unlock()
	g.createLoginStateLocked()
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

	username := g.Env.GetUsername()

	if err := g.loginState.Logout(); err != nil {
		return err
	}

	g.CallLogoutHooks()

	g.SetSharedDHKeyring(nil)

	if g.TrackCache != nil {
		g.TrackCache.Shutdown()
	}
	if g.Identify2Cache != nil {
		g.Identify2Cache.Shutdown()
	}
	if g.CardCache != nil {
		g.CardCache.Shutdown()
	}

	g.GetFullSelfer().OnLogout()

	g.TrackCache = NewTrackCache()
	g.Identify2Cache = NewIdentify2Cache(g.Env.GetUserCacheMaxAge())
	g.CardCache = NewUserCardCache(g.Env.GetUserCacheMaxAge())

	// get a clean LoginState:
	g.createLoginStateLocked()

	// remove stored secret
	if g.SecretStoreAll != nil {
		if err := g.SecretStoreAll.ClearSecret(username); err != nil {
			g.Log.Debug("clear stored secret error: %s", err)
		}
	}

	// reload config to clear anything in memory
	if err := g.ConfigReload(); err != nil {
		g.Log.Debug("Logout ConfigReload error: %s", err)
	}

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
	err := RemoteSettingsRepairman(g)
	if err != nil {
		return err
	}
	c := NewJSONConfigFile(g, g.Env.GetConfigFilename())
	err = c.Load(false)
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

func (g *GlobalContext) configureMemCachesLocked() {
	g.Resolver.EnableCaching()
	g.TrackCache = NewTrackCache()
	g.Identify2Cache = NewIdentify2Cache(g.Env.GetUserCacheMaxAge())
	g.Log.Debug("Created Identify2Cache, max age: %s", g.Env.GetUserCacheMaxAge())
	g.ProofCache = NewProofCache(g, g.Env.GetProofCacheSize())
	g.LinkCache = NewLinkCache(g.Env.GetLinkCacheSize(), g.Env.GetLinkCacheCleanDur())
	g.Log.Debug("Created LinkCache, max size: %d, clean dur: %s", g.Env.GetLinkCacheSize(), g.Env.GetLinkCacheCleanDur())
	g.CardCache = NewUserCardCache(g.Env.GetUserCacheMaxAge())
	g.Log.Debug("Created CardCache, max age: %s", g.Env.GetUserCacheMaxAge())
	g.fullSelfer = NewCachedFullSelf(g)
	g.Log.Debug("made a new full self cache")
	g.upakLoader = NewCachedUPAKLoader(g, CachedUserTimeout)
	g.Log.Debug("made a new cached UPAK loader (timeout=%v)", CachedUserTimeout)
}

func (g *GlobalContext) ConfigureMemCaches() {
	g.cacheMu.Lock()
	defer g.cacheMu.Unlock()
	g.configureMemCachesLocked()
}

func (g *GlobalContext) ConfigureCaches() error {
	g.cacheMu.Lock()
	defer g.cacheMu.Unlock()
	g.configureMemCachesLocked()
	return g.configureDiskCachesLocked()
}

func (g *GlobalContext) configureDiskCachesLocked() error {
	// We consider the local DBs as caches; they're caching our
	// fetches from the server after all (and also our cryptographic
	// checking).
	g.LocalDb = NewJSONLocalDb(NewLevelDb(g, g.Env.GetDbFilename))
	g.LocalChatDb = NewJSONLocalDb(NewLevelDb(g, g.Env.GetChatDbFilename))

	e1 := g.LocalDb.Open()
	e2 := g.LocalChatDb.Open()
	if e1 != nil {
		return e1
	}
	return e2
}

func (g *GlobalContext) ConfigureMerkleClient() error {
	g.MerkleClient = NewMerkleClient(g)
	return nil
}

func (g *GlobalContext) GetUPAKLoader() UPAKLoader {
	g.cacheMu.RLock()
	defer g.cacheMu.RUnlock()
	return g.upakLoader
}

func (g *GlobalContext) GetFullSelfer() FullSelfer {
	g.cacheMu.RLock()
	defer g.cacheMu.RUnlock()
	return g.fullSelfer
}

func (g *GlobalContext) GetPvlSource() PvlSource {
	return g.pvlSource
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
		if g.LocalChatDb != nil {
			epick.Push(g.LocalChatDb.Close())
		}
		g.loginStateMu.Lock()
		if g.loginState != nil {
			epick.Push(g.loginState.Shutdown())
		}
		g.loginStateMu.Unlock()

		if g.TrackCache != nil {
			g.TrackCache.Shutdown()
		}
		if g.Identify2Cache != nil {
			g.Identify2Cache.Shutdown()
		}
		if g.LinkCache != nil {
			g.LinkCache.Shutdown()
		}
		if g.CardCache != nil {
			g.CardCache.Shutdown()
		}
		if g.Resolver != nil {
			g.Resolver.Shutdown()
		}
		if g.MessageDeliverer != nil {
			g.MessageDeliverer.Stop(context.Background())
		}
		if g.ChatSyncer != nil {
			g.ChatSyncer.Shutdown()
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

	// SecretStoreAll must be created after SetCommandLine in order
	// to correctly use -H,-home flag.
	g.SecretStoreAll = NewSecretStoreLocked(g)

	return g.ConfigureUsage(usage)
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

type Contextifier interface {
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

func (g *GlobalContext) Clock() clockwork.Clock {
	g.clockMu.Lock()
	defer g.clockMu.Unlock()
	if g.clock == nil {
		g.clock = clockwork.NewRealClock()
	}
	return g.clock
}

func (g *GlobalContext) SetClock(c clockwork.Clock) {
	g.clockMu.Lock()
	defer g.clockMu.Unlock()
	g.clock = c
}

func (g *GlobalContext) GetMyClientDetails() keybase1.ClientDetails {
	return keybase1.ClientDetails{
		ClientType: keybase1.ClientType_CLI,
		Pid:        os.Getpid(),
		Argv:       os.Args,
		Version:    VersionString(),
	}
}

type UnforwardedLoggerWithLegacyInterface interface {
	Debug(s string, args ...interface{})
	Error(s string, args ...interface{})
	Errorf(s string, args ...interface{})
	Warning(s string, args ...interface{})
	Info(s string, args ...interface{})
	Profile(s string, args ...interface{})
}

func (g *GlobalContext) GetUnforwardedLogger() (log UnforwardedLoggerWithLegacyInterface) {
	defer func() {
		if log == nil {
			// Hopefully this won't happen before we get to refactor the logger
			// interfaces. If this happens, we really shouldn't return nil, but
			// rather fix whatever caused it.
			panic("can't make unforwarded logger")
		}
	}()
	if g.Log == nil {
		return nil
	}
	if log, ok := g.Log.(*logger.Standard); ok {
		return (*logger.UnforwardedLogger)(log)
	}
	if log, ok := g.Log.(*logger.TestLogger); ok {
		return log
	}
	return nil
}

// GetLogf returns a logger with a minimal formatter style interface
func (g *GlobalContext) GetLogf() logger.Loggerf {
	return logger.NewLoggerf(g.Log)
}

func (g *GlobalContext) AddLoginHook(hook LoginHook) {
	g.hookMu.Lock()
	defer g.hookMu.Unlock()
	g.loginHooks = append(g.loginHooks, hook)
}

func (g *GlobalContext) CallLoginHooks() {

	sdhk, err := NewSharedDHKeyring(g, g.GetMyUID(), g.Env.GetDeviceID())
	if err != nil {
		g.Log.Warning("NewSharedDHKeyring failed: %s", err)
	} else {
		g.SetSharedDHKeyring(sdhk)
	}

	// Do so outside the lock below
	g.GetFullSelfer().OnLogin()

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

func (g *GlobalContext) GetConfigDir() string {
	return g.Env.GetConfigDir()
}

func (g *GlobalContext) GetMountDir() (string, error) {
	return g.Env.GetMountDir()
}

// GetServiceInfoPath returns path to info file written by the Keybase service after startup
func (g *GlobalContext) GetServiceInfoPath() string {
	return g.Env.GetServiceInfoPath()
}

// GetKBFSInfoPath returns path to info file written by the KBFS service after startup
func (g *GlobalContext) GetKBFSInfoPath() string {
	return g.Env.GetKBFSInfoPath()
}

func (g *GlobalContext) GetLogDir() string {
	return g.Env.GetLogDir()
}

func (g *GlobalContext) GetDataDir() string {
	return g.Env.GetDataDir()
}

func (g *GlobalContext) NewRPCLogFactory() *RPCLogFactory {
	return &RPCLogFactory{Contextified: NewContextified(g)}
}

// LogoutIfRevoked loads the user and checks if the current device keys
// have been revoked.  If so, it calls Logout.
func (g *GlobalContext) LogoutIfRevoked() error {
	in, err := g.LoginState().LoggedInLoad()
	if err != nil {
		return err
	}
	if !in {
		g.Log.Debug("LogoutIfRevoked: skipping check (not logged in)")
		return nil
	}

	me, err := LoadMe(NewLoadUserForceArg(g))
	if err != nil {
		return err
	}

	if !me.HasCurrentDeviceInCurrentInstall() {
		g.Log.Debug("LogoutIfRevoked: current device revoked, calling logout")
		return g.Logout()
	}

	g.Log.Debug("LogoutIfRevoked: current device ok")

	return nil
}

func (g *GlobalContext) MakeAssertionContext() AssertionContext {
	if g.Services == nil {
		return nil
	}
	return MakeAssertionContext(g.Services)
}

func (g *GlobalContext) SetServices(s ExternalServicesCollector) {
	g.Services = s
}

func (g *GlobalContext) SetPvlSource(s PvlSource) {
	g.pvlSource = s
}

func (g *GlobalContext) LoadUserByUID(uid keybase1.UID) (*User, error) {
	arg := NewLoadUserByUIDArg(nil, g, uid)
	arg.PublicKeyOptional = true
	return LoadUser(arg)
}

func (g *GlobalContext) UIDToUsername(uid keybase1.UID) (NormalizedUsername, error) {
	q := NewHTTPArgs()
	q.Add("uid", UIDArg(uid))
	leaf, err := g.MerkleClient.LookupUser(g.NetContext, q, nil)
	if err != nil {
		return NormalizedUsername(""), err
	}
	return NewNormalizedUsername(leaf.username), nil
}

func (g *GlobalContext) BustLocalUserCache(u keybase1.UID) {
	g.GetUPAKLoader().Invalidate(g.NetContext, u)
	g.GetFullSelfer().HandleUserChanged(u)
}

func (g *GlobalContext) OverrideUPAKLoader(upak UPAKLoader) {
	g.upakLoader = upak
}

func (g *GlobalContext) AddUserChangedHandler(h UserChangedHandler) {
	g.uchMu.Lock()
	g.UserChangedHandlers = append(g.UserChangedHandlers, h)
	g.uchMu.Unlock()
}

func (g *GlobalContext) GetOutOfDateInfo() keybase1.OutOfDateInfo {
	g.oodiMu.RLock()
	ret := *g.outOfDateInfo
	g.oodiMu.RUnlock()
	return ret
}

func (g *GlobalContext) KeyfamilyChanged(u keybase1.UID) {
	g.Log.Debug("+ KeyfamilyChanged(%s)", u)
	defer g.Log.Debug("- KeyfamilyChanged(%s)", u)

	// Make sure we kill the UPAK and full self cache for this user
	g.BustLocalUserCache(u)

	if g.NotifyRouter != nil {
		g.NotifyRouter.HandleKeyfamilyChanged(u)
		// TODO: remove this when KBFS handles KeyfamilyChanged
		g.NotifyRouter.HandleUserChanged(u)
	}
}

func (g *GlobalContext) UserChanged(u keybase1.UID) {
	g.Log.Debug("+ UserChanged(%s)", u)
	defer g.Log.Debug("- UserChanged(%s)", u)

	g.SetSharedDHKeyring(nil)

	g.BustLocalUserCache(u)
	if g.NotifyRouter != nil {
		g.NotifyRouter.HandleUserChanged(u)
	}

	g.uchMu.Lock()
	list := g.UserChangedHandlers
	var newList []UserChangedHandler
	for _, cc := range list {
		if err := cc.HandleUserChanged(u); err == nil {
			newList = append(newList, cc)
		}
	}
	g.UserChangedHandlers = newList
	g.uchMu.Unlock()
}

func (g *GlobalContext) GetSharedDHKeyring() (*SharedDHKeyring, error) {
	g.sharedDHKeyringMu.Lock()
	defer g.sharedDHKeyringMu.Unlock()
	if g.sharedDHKeyring == nil {
		return nil, fmt.Errorf("SharedDHKeyring not present")
	}
	return g.sharedDHKeyring, nil
}

func (g *GlobalContext) SetSharedDHKeyring(k *SharedDHKeyring) {
	g.sharedDHKeyringMu.Lock()
	defer g.sharedDHKeyringMu.Unlock()
	g.sharedDHKeyring = k
}
