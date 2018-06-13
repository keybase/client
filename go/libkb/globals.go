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
	"errors"
	"fmt"
	"io"
	"os"
	"runtime"
	"sync"
	"time"

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

type StandaloneChatConnector interface {
	StartStandaloneChat(g *GlobalContext) error
}

type GlobalContext struct {
	Log              logger.Logger // Handles all logging
	VDL              *VDebugLog    // verbose debug log
	Env              *Env          // Env variables, cmdline args & config
	SKBKeyringMu     *sync.Mutex   // Protects all attempts to mutate the SKBKeyringFile
	Keyrings         *Keyrings     // Gpg Keychains holding keys
	perUserKeyringMu *sync.Mutex
	perUserKeyring   *PerUserKeyring      // Keyring holding per user keys
	API              API                  // How to make a REST call to the server
	Resolver         *Resolver            // cache of resolve results
	LocalDb          *JSONLocalDb         // Local DB for cache
	LocalChatDb      *JSONLocalDb         // Local DB for cache
	MerkleClient     *MerkleClient        // client for querying server's merkle sig tree
	XAPI             ExternalAPI          // for contacting Twitter, Github, etc.
	Output           io.Writer            // where 'Stdout'-style output goes
	DNSNSFetcher     DNSNameServerFetcher // The mobile apps potentially pass an implementor of this interface which is used to grab currently configured DNS name servers
	AppState         *AppState            // The state of focus for the currently running instance of the app
	ChatHelper       ChatHelper           // conveniently send chat messages

	cacheMu          *sync.RWMutex    // protects all caches
	ProofCache       *ProofCache      // where to cache proof results
	TrackCache       *TrackCache      // cache of IdentifyOutcomes for tracking purposes
	Identify2Cache   Identify2Cacher  // cache of Identify2 results for fast-pathing identify2 RPCS
	LinkCache        *LinkCache       // cache of ChainLinks
	upakLoader       UPAKLoader       // Load flat users with the ability to hit the cache
	teamLoader       TeamLoader       // Play back teams for id/name properties
	stellar          Stellar          // Stellar related ops
	deviceEKStorage  DeviceEKStorage  // Store device ephemeral keys
	userEKBoxStorage UserEKBoxStorage // Store user ephemeral key boxes
	teamEKBoxStorage TeamEKBoxStorage // Store team ephemeral key boxes
	ekLib            EKLib            // Wrapper to call ephemeral key methods
	itciCacher       LRUer            // Cacher for implicit team conflict info
	CardCache        *UserCardCache   // cache of keybase1.UserCard objects
	fullSelfer       FullSelfer       // a loader that gets the full self object
	pvlSource        PvlSource        // a cache and fetcher for pvl
	PayloadCache     *PayloadCache    // cache of ChainLink payload json wrappers

	GpgClient        *GpgCLI        // A standard GPG-client (optional)
	ShutdownHooks    []ShutdownHook // on shutdown, fire these...
	SocketInfo       Socket         // which socket to bind/connect to
	socketWrapperMu  *sync.RWMutex
	SocketWrapper    *SocketWrapper    // only need one connection per
	LoopbackListener *LoopbackListener // If we're in loopback mode, we'll connect through here
	XStreams         *ExportedStreams  // a table of streams we've exported to the daemon (or vice-versa)
	Timers           *TimerSet         // Which timers are currently configured on
	UI               UI                // Interact with the UI
	Service          bool              // whether we're in server mode
	Standalone       bool              // whether we're launched as standalone command

	shutdownOnce      *sync.Once         // whether we've shut down or not
	ConnectionManager *ConnectionManager // keep tabs on all active client connections
	NotifyRouter      *NotifyRouter      // How to route notifications
	// How to route UIs. Nil if we're in standalone mode or in
	// tests, and non-nil in service mode.
	UIRouter           UIRouter                  // How to route UIs
	Services           ExternalServicesCollector // All known external services
	UIDMapper          UIDMapper                 // maps from UID to Usernames
	ExitCode           keybase1.ExitCode         // Value to return to OS on Exit()
	RateLimits         *RateLimits               // tracks the last time certain actions were taken
	clockMu            *sync.Mutex               // protects Clock
	clock              clockwork.Clock           // RealClock unless we're testing
	secretStoreMu      *sync.Mutex               // protects secretStore
	secretStore        *SecretStoreLocked        // SecretStore
	hookMu             *sync.RWMutex             // protects loginHooks, logoutHooks
	loginHooks         []LoginHook               // call these on login
	logoutHooks        []LogoutHook              // call these on logout
	GregorDismisser    GregorDismisser           // for dismissing gregor items that we've handled
	GregorListener     GregorListener            // for alerting about clients connecting and registering UI protocols
	oodiMu             *sync.RWMutex             // For manipulating the OutOfDateInfo
	outOfDateInfo      *keybase1.OutOfDateInfo   // Stores out of date messages we got from API server headers.
	lastUpgradeWarning *time.Time                // When the last upgrade was warned for (to reate-limit nagging)

	uchMu               *sync.Mutex          // protects the UserChangedHandler array
	UserChangedHandlers []UserChangedHandler // a list of handlers that deal generically with userchanged events
	ConnectivityMonitor ConnectivityMonitor  // Detect whether we're connected or not.
	localSigchainGuard  *LocalSigchainGuard  // Non-strict guard for shoeing away bg tasks when the user is doing sigchain actions

	StandaloneChatConnector StandaloneChatConnector

	// Can be overloaded by tests to get an improvement in performance
	NewTriplesec func(pw []byte, salt []byte) (Triplesec, error)

	// Options specified for testing only
	TestOptions GlobalTestOptions

	// It is threadsafe to call methods on ActiveDevice which will always be non-nil.
	// But don't access its members directly. If you're going to be changing out the
	// user (and resetting the ActiveDevice), then you should hold the switchUserMu
	switchUserMu *sync.Mutex
	ActiveDevice *ActiveDevice

	NetContext context.Context
}

// There are many interfaces that slice and dice the GlobalContext to expose a
// smaller API. TODO: Assert more of them here.
var _ ProofContext = (*GlobalContext)(nil)

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
func (g *GlobalContext) GetKVStore() KVStorer                          { return g.LocalDb }
func (g *GlobalContext) GetClock() clockwork.Clock                     { return g.Clock() }
func (g *GlobalContext) GetEKLib() EKLib                               { return g.ekLib }

type LogGetter func() logger.Logger

// Note: all these sync.Mutex fields are pointers so that the Clone funcs work.
func NewGlobalContext() *GlobalContext {
	log := logger.New("keybase")
	return &GlobalContext{
		Log:                log,
		VDL:                NewVDebugLog(log),
		SKBKeyringMu:       new(sync.Mutex),
		perUserKeyringMu:   new(sync.Mutex),
		cacheMu:            new(sync.RWMutex),
		socketWrapperMu:    new(sync.RWMutex),
		shutdownOnce:       new(sync.Once),
		clockMu:            new(sync.Mutex),
		clock:              clockwork.NewRealClock(),
		hookMu:             new(sync.RWMutex),
		oodiMu:             new(sync.RWMutex),
		outOfDateInfo:      &keybase1.OutOfDateInfo{},
		lastUpgradeWarning: new(time.Time),
		uchMu:              new(sync.Mutex),
		secretStoreMu:      new(sync.Mutex),
		NewTriplesec:       NewSecureTriplesec,
		ActiveDevice:       NewActiveDevice(),
		switchUserMu:       new(sync.Mutex),
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

func init() {
}

func (g *GlobalContext) SetCommandLine(cmd CommandLine) { g.Env.SetCommandLine(cmd) }

func (g *GlobalContext) SetUI(u UI) { g.UI = u }

func (g *GlobalContext) SetEKLib(ekLib EKLib) { g.ekLib = ekLib }

func (g *GlobalContext) Init() *GlobalContext {
	g.Env = NewEnv(nil, nil, g.GetLog)
	g.Service = false
	g.Resolver = NewResolver(g)
	g.RateLimits = NewRateLimits(g)
	g.upakLoader = NewUncachedUPAKLoader(g)
	g.teamLoader = newNullTeamLoader(g)
	g.stellar = newNullStellar(g)
	g.fullSelfer = NewUncachedFullSelf(g)
	g.ConnectivityMonitor = NullConnectivityMonitor{}
	g.localSigchainGuard = NewLocalSigchainGuard(g)
	g.AppState = NewAppState(g)

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

func (g *GlobalContext) SetUIDMapper(u UIDMapper) {
	g.UIDMapper = u
}

func (g *GlobalContext) SetUIRouter(u UIRouter) {
	g.UIRouter = u
}

func (g *GlobalContext) SetDNSNameServerFetcher(d DNSNameServerFetcher) {
	g.DNSNSFetcher = d
}

// simulateServiceRestart simulates what happens when a service restarts for the
// purposes of testing.
func (g *GlobalContext) simulateServiceRestart() {
	g.switchUserMu.Lock()
	defer g.switchUserMu.Unlock()
	g.ActiveDevice.Clear(nil)
}

func (g *GlobalContext) Logout() error {
	g.switchUserMu.Lock()
	defer g.switchUserMu.Unlock()

	username := g.Env.GetUsername()

	g.ActiveDevice.Clear(nil)

	g.LocalSigchainGuard().Clear(context.TODO(), "Logout")

	g.CallLogoutHooks()

	g.ClearPerUserKeyring()

	// NB: This will acquire and release the cacheMu lock, so we have to make
	// sure nothing holding a cacheMu ever looks for the switchUserMu lock.
	g.FlushCaches()

	tl := g.teamLoader
	if tl != nil {
		tl.OnLogout()
	}

	st := g.stellar
	if st != nil {
		st.OnLogout()
	}

	// remove stored secret
	g.secretStoreMu.Lock()
	if g.secretStore != nil {
		if err := g.secretStore.ClearSecret(username); err != nil {
			g.Log.Debug("clear stored secret error: %s", err)
		}
	}
	g.secretStoreMu.Unlock()

	// reload config to clear anything in memory
	if err := g.ConfigReload(); err != nil {
		g.Log.Debug("Logout ConfigReload error: %s", err)
	}

	// send logout notification
	g.NotifyRouter.HandleLogout()

	return nil
}

func (g *GlobalContext) ConfigureLogging() error {
	style := g.Env.GetLogFormat()
	debug := g.Env.GetDebug()
	logFile := g.Env.GetLogFile()
	if logFile == "" {
		filePrefix := g.Env.GetLogPrefix()
		if filePrefix != "" {
			filePrefix = filePrefix + time.Now().Format("20060102T150405.999999999Z0700")
			logFile = filePrefix + ".log"
		}
	}
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

func (g *GlobalContext) configureMemCachesLocked(isFlush bool) {
	// shutdown any existing ones
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

	g.Resolver.EnableCaching()
	g.TrackCache = NewTrackCache()
	g.Identify2Cache = NewIdentify2Cache(g.Env.GetUserCacheMaxAge())
	g.Log.Debug("Created Identify2Cache, max age: %s", g.Env.GetUserCacheMaxAge())

	g.LinkCache = NewLinkCache(g.Env.GetLinkCacheSize(), g.Env.GetLinkCacheCleanDur())
	g.Log.Debug("Created LinkCache, max size: %d, clean dur: %s", g.Env.GetLinkCacheSize(), g.Env.GetLinkCacheCleanDur())
	g.CardCache = NewUserCardCache(g.Env.GetUserCacheMaxAge())
	g.Log.Debug("Created CardCache, max age: %s", g.Env.GetUserCacheMaxAge())

	// If we're just flushing the caches, and already have a Proof cache, then the right idea
	// is just to reset what's in the ProofCache. Otherwise, we make a new one.
	if isFlush && g.ProofCache != nil {
		g.ProofCache.Reset()
	} else {
		g.ProofCache = NewProofCache(g, g.Env.GetProofCacheSize())
	}

	// If it's startup (and not a "flush"), then install a new full selfer
	// cache. Otherwise, just make a new instance of the kind that's already there.
	if isFlush {
		g.fullSelfer = g.fullSelfer.New()
	} else {
		g.fullSelfer = NewCachedFullSelf(g)
	}

	g.Log.Debug("made a new full self cache")
	g.upakLoader = NewCachedUPAKLoader(g, CachedUserTimeout)
	g.Log.Debug("made a new cached UPAK loader (timeout=%v)", CachedUserTimeout)
	g.PayloadCache = NewPayloadCache(g, g.Env.GetPayloadCacheSize())
}

func (g *GlobalContext) ConfigureCaches() error {
	g.cacheMu.Lock()
	defer g.cacheMu.Unlock()
	g.configureMemCachesLocked(false)
	return g.configureDiskCachesLocked()
}

func (g *GlobalContext) FlushCaches() {
	g.cacheMu.Lock()
	defer g.cacheMu.Unlock()
	g.configureMemCachesLocked(true)
}

func (g *GlobalContext) configureDiskCachesLocked() error {
	// We consider the local DBs as caches; they're caching our
	// fetches from the server after all (and also our cryptographic
	// checking).
	g.LocalDb = NewJSONLocalDb(NewLevelDb(g, g.Env.GetDbFilename))
	g.LocalChatDb = NewJSONLocalDb(NewLevelDb(g, g.Env.GetChatDbFilename))

	epick := FirstErrorPicker{}
	epick.Push(g.LocalDb.Open())
	epick.Push(g.LocalChatDb.Open())
	return epick.Error()
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

func (g *GlobalContext) GetTeamLoader() TeamLoader {
	g.cacheMu.RLock()
	defer g.cacheMu.RUnlock()
	return g.teamLoader
}

func (g *GlobalContext) GetStellar() Stellar {
	g.cacheMu.RLock()
	defer g.cacheMu.RUnlock()
	return g.stellar
}

func (g *GlobalContext) GetDeviceEKStorage() DeviceEKStorage {
	g.cacheMu.RLock()
	defer g.cacheMu.RUnlock()
	return g.deviceEKStorage
}

func (g *GlobalContext) GetUserEKBoxStorage() UserEKBoxStorage {
	g.cacheMu.RLock()
	defer g.cacheMu.RUnlock()
	return g.userEKBoxStorage
}

func (g *GlobalContext) GetTeamEKBoxStorage() TeamEKBoxStorage {
	g.cacheMu.RLock()
	defer g.cacheMu.RUnlock()
	return g.teamEKBoxStorage
}

func (g *GlobalContext) GetImplicitTeamConflictInfoCacher() LRUer {
	g.cacheMu.RLock()
	defer g.cacheMu.RUnlock()
	return g.itciCacher
}

func (g *GlobalContext) SetImplicitTeamConflictInfoCacher(l LRUer) {
	g.cacheMu.RLock()
	defer g.cacheMu.RUnlock()
	g.itciCacher = l
}

func (g *GlobalContext) GetFullSelfer() FullSelfer {
	g.cacheMu.RLock()
	defer g.cacheMu.RUnlock()
	return g.fullSelfer
}

// to implement ProofContext
func (g *GlobalContext) GetPvlSource() PvlSource {
	return g.pvlSource
}

// to implement ProofContext
func (g *GlobalContext) GetAppType() AppType {
	return g.Env.GetAppType()
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

	if err := g.ConfigureUsage(usage); err != nil {
		return err
	}

	// secretStore must be created after SetCommandLine and ConfigureUsage in
	// order to correctly use -H,-home flag and config vars for
	// remember_passphrase.
	g.secretStoreMu.Lock()
	g.secretStore = NewSecretStoreLocked(g)
	g.secretStoreMu.Unlock()

	return nil
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

	return g.ConfigureTimers()
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

	// Prefer ActiveDevice, that's the prefered way
	// to figure out what the current user's UID is.
	uid = g.ActiveDevice.UID()
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
	return c.g
}

func (c Contextified) MetaContext(ctx context.Context) MetaContext {
	return NewMetaContext(ctx, c.g)
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
	g.secretStoreMu.Lock()
	defer g.secretStoreMu.Unlock()
	return GetConfiguredAccounts(g, g.secretStore)
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
	g.secretStoreMu.Lock()
	defer g.secretStoreMu.Unlock()
	if g.secretStore != nil {
		return g.secretStore.GetUsersWithStoredSecrets()
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
	g.Log.Debug("G#CallLoginHooks")

	// Trigger the creation of a per-user-keyring
	_, _ = g.GetPerUserKeyring()

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

// LogoutSelfCheck checks with the API server to see if this uid+device pair should
// logout.
func (g *GlobalContext) LogoutSelfCheck() error {
	uid := g.ActiveDevice.UID()
	if uid.IsNil() {
		g.Log.Debug("LogoutSelfCheck: no uid")
		return nil
	}
	deviceID := g.ActiveDevice.DeviceID()
	if deviceID.IsNil() {
		g.Log.Debug("LogoutSelfCheck: no device id")
		return nil
	}

	arg := APIArg{
		NetContext: context.Background(),
		Endpoint:   "selfcheck",
		Args: HTTPArgs{
			"uid":       S{Val: uid.String()},
			"device_id": S{Val: deviceID.String()},
		},
		SessionType: APISessionTypeREQUIRED,
	}
	res, err := g.API.Post(arg)
	if err != nil {
		return err
	}

	logout, err := res.Body.AtKey("logout").GetBool()
	if err != nil {
		return err
	}

	g.Log.Debug("LogoutSelfCheck: should log out? %v", logout)
	if logout {
		g.Log.Debug("LogoutSelfCheck: logging out...")
		return g.Logout()
	}

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

func (g *GlobalContext) SetTeamLoader(l TeamLoader) {
	g.cacheMu.Lock()
	defer g.cacheMu.Unlock()
	g.teamLoader = l
}

func (g *GlobalContext) SetStellar(s Stellar) {
	g.cacheMu.Lock()
	defer g.cacheMu.Unlock()
	g.stellar = s
}

func (g *GlobalContext) SetDeviceEKStorage(s DeviceEKStorage) {
	g.cacheMu.Lock()
	defer g.cacheMu.Unlock()
	g.deviceEKStorage = s
}

func (g *GlobalContext) SetUserEKBoxStorage(s UserEKBoxStorage) {
	g.cacheMu.Lock()
	defer g.cacheMu.Unlock()
	g.userEKBoxStorage = s
}

func (g *GlobalContext) SetTeamEKBoxStorage(s TeamEKBoxStorage) {
	g.cacheMu.Lock()
	defer g.cacheMu.Unlock()
	g.teamEKBoxStorage = s
}

func (g *GlobalContext) LoadUserByUID(uid keybase1.UID) (*User, error) {
	arg := NewLoadUserArgWithMetaContext(NewMetaContextBackground(g)).WithUID(uid).WithPublicKeyOptional()
	return LoadUser(arg)
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

	_, _ = g.GetPerUserKeyring()

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

// GetPerUserKeyring recreates PerUserKeyring if the uid changes or this is none installed.
func (g *GlobalContext) GetPerUserKeyring() (ret *PerUserKeyring, err error) {
	defer g.Trace("G#GetPerUserKeyring", func() error { return err })()

	myUID := g.ActiveDevice.UID()
	if myUID.IsNil() {
		return nil, errors.New("PerUserKeyring unavailable with no UID")
	}

	// Don't do any operations under these locks that could come back and hit them again.
	// That's why GetMyUID up above is not under this lock.
	g.perUserKeyringMu.Lock()
	defer g.perUserKeyringMu.Unlock()

	makeNew := func() (*PerUserKeyring, error) {
		pukring, err := NewPerUserKeyring(g, myUID)
		if err != nil {
			g.Log.Warning("G#GetPerUserKeyring -> failed: %s", err)
			g.perUserKeyring = nil
			return nil, err
		}
		g.Log.Debug("G#GetPerUserKeyring -> new")
		g.perUserKeyring = pukring
		return g.perUserKeyring, nil
	}

	if g.perUserKeyring == nil {
		return makeNew()
	}
	pukUID := g.perUserKeyring.GetUID()
	if pukUID.Equal(myUID) {
		return g.perUserKeyring, nil
	}
	return makeNew()
}

func (g *GlobalContext) ClearPerUserKeyring() {
	defer g.Trace("G#ClearPerUserKeyring", func() error { return nil })()

	g.perUserKeyringMu.Lock()
	defer g.perUserKeyringMu.Unlock()
	g.perUserKeyring = nil
}

func (g *GlobalContext) LocalSigchainGuard() *LocalSigchainGuard {
	return g.localSigchainGuard
}

func (g *GlobalContext) StartStandaloneChat() {
	if !g.Standalone {
		return
	}

	if g.StandaloneChatConnector == nil {
		g.Log.Warning("G#StartStandaloneChat - not starting chat, StandaloneChatConnector is nil.")
		return
	}

	g.StandaloneChatConnector.StartStandaloneChat(g)
}

func (g *GlobalContext) SecretStore() *SecretStoreLocked {
	g.secretStoreMu.Lock()
	defer g.secretStoreMu.Unlock()

	return g.secretStore
}

// ReplaceSecretStore gets the existing secret out of the existing
// secret store, creates a new secret store (could be a new type
// of SecretStore based on a config change), and inserts the secret
// into the new secret store.
func (g *GlobalContext) ReplaceSecretStore() error {
	g.secretStoreMu.Lock()
	defer g.secretStoreMu.Unlock()

	username := g.Env.GetUsername()

	// get the current secret
	secret, err := g.secretStore.RetrieveSecret(username)
	if err != nil {
		g.Log.Debug("error retrieving existing secret for ReplaceSecretStore: %s", err)
		return err
	}

	// clear the existing secret from the existing secret store
	if err := g.secretStore.ClearSecret(username); err != nil {
		g.Log.Debug("error clearing existing secret for ReplaceSecretStore: %s", err)
		return err
	}

	// make a new secret store
	g.secretStore = NewSecretStoreLocked(g)

	// store the secret in the secret store
	if err := g.secretStore.StoreSecret(username, secret); err != nil {
		g.Log.Debug("error storing existing secret for ReplaceSecretStore: %s", err)
		return err
	}

	g.Log.Debug("ReplaceSecretStore success")

	return nil
}

func (g *GlobalContext) IsOneshot(ctx context.Context) (bool, error) {
	uc, err := g.Env.GetConfig().GetUserConfig()
	if err != nil {
		g.Log.CDebugf(ctx, "IsOneshot: Error getting a user config: %s", err)
		return false, err
	}
	if uc == nil {
		g.Log.CDebugf(ctx, "IsOneshot: nil user config")
		return false, nil
	}
	return uc.IsOneshot(), nil
}

func (g *GlobalContext) GetMeUV(ctx context.Context) (res keybase1.UserVersion, err error) {
	defer g.CTraceTimed(ctx, "GlobalContext.GetMeUV", func() error { return err })()
	meUID := g.ActiveDevice.UID()
	if meUID.IsNil() {
		return res, LoginRequiredError{}
	}
	loadMeArg := NewLoadUserArgWithContext(ctx, g).
		WithUID(meUID).
		WithSelf(true).
		WithPublicKeyOptional()
	upkv2, _, err := g.GetUPAKLoader().LoadV2(loadMeArg)
	if err != nil {
		return res, err
	}
	if upkv2 == nil {
		return res, fmt.Errorf("could not load logged-in user")
	}
	return upkv2.Current.ToUserVersion(), nil
}
