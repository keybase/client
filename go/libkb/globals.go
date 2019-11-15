/// Copyright 2015 Keybase, Inc. All rights reserved. Use of
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

type ShutdownHook func(mctx MetaContext) error

type LoginHook interface {
	OnLogin(mctx MetaContext) error
}

type LogoutHook interface {
	OnLogout(mctx MetaContext) error
}

type DbNukeHook interface {
	OnDbNuke(mctx MetaContext) error
}

type GlobalContext struct {
	Log              logger.Logger         // Handles all logging
	VDL              *VDebugLog            // verbose debug log
	GUILogFile       *logger.LogFileWriter // GUI logs
	Env              *Env                  // Env variables, cmdline args & config
	SKBKeyringMu     *sync.Mutex           // Protects all attempts to mutate the SKBKeyringFile
	Keyrings         *Keyrings             // Gpg Keychains holding keys
	perUserKeyringMu *sync.Mutex
	perUserKeyring   *PerUserKeyring       // Keyring holding per user keys
	API              API                   // How to make a REST call to the server
	Resolver         Resolver              // cache of resolve results
	LocalDb          *JSONLocalDb          // Local DB for cache
	LocalChatDb      *JSONLocalDb          // Local DB for cache
	MerkleClient     MerkleClientInterface // client for querying server's merkle sig tree
	XAPI             ExternalAPI           // for contacting Twitter, Github, etc.
	Output           io.Writer             // where 'Stdout'-style output goes
	DNSNSFetcher     DNSNameServerFetcher  // The mobile apps potentially pass an implementor of this interface which is used to grab currently configured DNS name servers
	MobileNetState   *MobileNetState       // The kind of network connection for the currently running instance of the app
	MobileAppState   *MobileAppState       // The state of focus for the currently running instance of the app
	DesktopAppState  *DesktopAppState      // The state of focus for the currently running instance of the app
	ChatHelper       ChatHelper            // conveniently send chat messages
	RPCCanceler      *RPCCanceler          // register live RPCs so they can be cancelleed en masse
	IdentifyDispatch *IdentifyDispatch     // get notified of identify successes
	Identify3State   *Identify3State       // keep track of Identify3 sessions
	vidMu            *sync.Mutex           // protect VID

	cacheMu                *sync.RWMutex   // protects all caches
	ProofCache             *ProofCache     // where to cache proof results
	trackCache             *TrackCache     // cache of IdentifyOutcomes for tracking purposes
	identify2Cache         Identify2Cacher // cache of Identify2 results for fast-pathing identify2 RPCS
	linkCache              *LinkCache      // cache of ChainLinks
	upakLoader             UPAKLoader      // Load flat users with the ability to hit the cache
	teamLoader             TeamLoader      // Play back teams for id/name properties
	fastTeamLoader         FastTeamLoader  // Play back team in "fast" mode for keys and names only
	hiddenTeamChainManager HiddenTeamChainManager
	TeamRoleMapManager     TeamRoleMapManager
	IDLocktab              *LockTable
	loadUserLockTab        *LockTable
	teamAuditor            TeamAuditor
	teamBoxAuditor         TeamBoxAuditor
	stellar                Stellar            // Stellar related ops
	deviceEKStorage        DeviceEKStorage    // Store device ephemeral keys
	userEKBoxStorage       UserEKBoxStorage   // Store user ephemeral key boxes
	teamEKBoxStorage       TeamEKBoxStorage   // Store team ephemeral key boxes
	teambotEKBoxStorage    TeamEKBoxStorage   // Store team bot ephemeral key boxes
	ekLib                  EKLib              // Wrapper to call ephemeral key methods
	teambotBotKeyer        TeambotBotKeyer    // TeambotKeyer for bot members
	teambotMemberKeyer     TeambotMemberKeyer // TeambotKeyer for non-bot members
	itciCacher             LRUer              // Cacher for implicit team conflict info
	iteamCacher            MemLRUer           // In memory cacher for implicit teams
	cardCache              *UserCardCache     // cache of keybase1.UserCard objects
	fullSelfer             FullSelfer         // a loader that gets the full self object
	pvlSource              MerkleStore        // a cache and fetcher for pvl
	paramProofStore        MerkleStore        // a cache and fetcher for param proofs
	externalURLStore       MerkleStore        // a cache and fetcher for external urls
	PayloadCache           *PayloadCache      // cache of ChainLink payload json wrappers
	kvRevisionCache        KVRevisionCacher   // cache of revisions for verifying key-value store results
	Pegboard               *Pegboard

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
	proofServices      ExternalServicesCollector // All known external services
	UIDMapper          UIDMapper                 // maps from UID to Usernames
	ServiceMapper      ServiceSummaryMapper      // handles and caches batch requests for service summaries
	ExitCode           keybase1.ExitCode         // Value to return to OS on Exit()
	RateLimits         *RateLimits               // tracks the last time certain actions were taken
	clockMu            *sync.Mutex               // protects Clock
	clock              clockwork.Clock           // RealClock unless we're testing
	secretStoreMu      *sync.Mutex               // protects secretStore
	secretStore        *SecretStoreLocked        // SecretStore
	hookMu             *sync.RWMutex             // protects loginHooks, logoutHooks
	loginHooks         []LoginHook               // call these on login
	logoutHooks        []NamedLogoutHook         // call these on logout
	dbNukeHooks        []NamedDbNukeHook         // call these on dbnuke
	GregorState        GregorState               // for dismissing gregor items that we've handled
	GregorListener     GregorListener            // for alerting about clients connecting and registering UI protocols
	oodiMu             *sync.RWMutex             // For manipulating the OutOfDateInfo
	outOfDateInfo      *keybase1.OutOfDateInfo   // Stores out of date messages we got from API server headers.
	lastUpgradeWarning *time.Time                // When the last upgrade was warned for (to reate-limit nagging)

	uchMu               *sync.Mutex          // protects the UserChangedHandler array
	UserChangedHandlers []UserChangedHandler // a list of handlers that deal generically with userchanged events
	ConnectivityMonitor ConnectivityMonitor  // Detect whether we're connected or not.
	localSigchainGuard  *LocalSigchainGuard  // Non-strict guard for shoeing away bg tasks when the user is doing sigchain actions
	FeatureFlags        *FeatureFlagSet      // user's feature flag set

	StandaloneChatConnector StandaloneChatConnector

	// Can be overloaded by tests to get an improvement in performance
	NewTriplesec func(pw []byte, salt []byte) (Triplesec, error)

	// Options specified for testing only
	TestOptions GlobalTestOptions

	// It is threadsafe to call methods on ActiveDevice which will always be non-nil.
	// But don't access its members directly. If you're going to be changing out the
	// user (and resetting the ActiveDevice), then you should hold the switchUserMu
	switchUserMu  *VerboseLock
	ActiveDevice  *ActiveDevice
	switchedUsers map[NormalizedUsername]bool // bookkeep users who have been switched over (and are still in secret store)

	// OS Version passed from mobile native code. iOS and Android only.
	// See go/bind/keybase.go
	MobileOsVersion string

	SyncedContactList SyncedContactListProvider

	GUIConfig *JSONFile

	avatarLoader AvatarLoaderSource
}

type GlobalTestOptions struct {
	NoBug3964Repair             bool
	NoAutorotateOnBoxAuditRetry bool
}

func (g *GlobalContext) GetLog() logger.Logger                         { return g.Log }
func (g *GlobalContext) GetGUILogWriter() io.Writer                    { return g.GUILogFile }
func (g *GlobalContext) GetVDebugLog() *VDebugLog                      { return g.VDL }
func (g *GlobalContext) GetAPI() API                                   { return g.API }
func (g *GlobalContext) GetExternalAPI() ExternalAPI                   { return g.XAPI }
func (g *GlobalContext) GetServerURI() (string, error)                 { return g.Env.GetServerURI() }
func (g *GlobalContext) GetEnv() *Env                                  { return g.Env }
func (g *GlobalContext) GetDNSNameServerFetcher() DNSNameServerFetcher { return g.DNSNSFetcher }
func (g *GlobalContext) GetKVStore() KVStorer                          { return g.LocalDb }
func (g *GlobalContext) GetClock() clockwork.Clock                     { return g.Clock() }
func (g *GlobalContext) GetEKLib() EKLib                               { return g.ekLib }
func (g *GlobalContext) GetTeambotBotKeyer() TeambotBotKeyer           { return g.teambotBotKeyer }
func (g *GlobalContext) GetTeambotMemberKeyer() TeambotMemberKeyer     { return g.teambotMemberKeyer }
func (g *GlobalContext) GetProofServices() ExternalServicesCollector   { return g.proofServices }
func (g *GlobalContext) GetAvatarLoader() AvatarLoaderSource           { return g.avatarLoader }

type LogGetter func() logger.Logger

// Note: all these sync.Mutex fields are pointers so that the Clone funcs work.
func NewGlobalContext() *GlobalContext {
	log := logger.New("keybase")
	ret := &GlobalContext{
		Log:                log,
		VDL:                NewVDebugLog(log),
		SKBKeyringMu:       new(sync.Mutex),
		perUserKeyringMu:   new(sync.Mutex),
		vidMu:              new(sync.Mutex),
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
		switchUserMu:       NewVerboseLock(VLog0, "switchUserMu"),
		FeatureFlags:       NewFeatureFlagSet(),
		switchedUsers:      make(map[NormalizedUsername]bool),
		Pegboard:           NewPegboard(),
	}
	return ret
}

func init() {
}

func (g *GlobalContext) SetCommandLine(cmd CommandLine) { g.Env.SetCommandLine(cmd) }

func (g *GlobalContext) SetUI(u UI) { g.UI = u }

func (g *GlobalContext) SetEKLib(ekLib EKLib) { g.ekLib = ekLib }

func (g *GlobalContext) SetTeambotBotKeyer(keyer TeambotBotKeyer) { g.teambotBotKeyer = keyer }

func (g *GlobalContext) SetTeambotMemberKeyer(keyer TeambotMemberKeyer) { g.teambotMemberKeyer = keyer }

func (g *GlobalContext) initGUILogFile() {
	config := g.Env.GetLogFileConfig(g.Env.GetGUILogFile())
	config.SkipRedirectStdErr = true
	fileWriter := logger.NewLogFileWriter(*config)
	if err := fileWriter.Open(g.GetClock().Now()); err != nil {
		g.GetLog().Debug("Unable to init GUI log file %v", err)
		return
	}
	g.GUILogFile = fileWriter
}

func (g *GlobalContext) Init() *GlobalContext {
	g.Env = NewEnv(nil, nil, g.GetLog)
	g.Service = false
	g.Resolver = NewResolverImpl()
	g.RateLimits = NewRateLimits(g)
	g.upakLoader = NewUncachedUPAKLoader(g)
	g.teamLoader = newNullTeamLoader(g)
	g.fastTeamLoader = newNullFastTeamLoader()
	g.hiddenTeamChainManager = newNullHiddenTeamChainManager()
	g.TeamRoleMapManager = newNullTeamRoleMapManager()
	g.teamAuditor = newNullTeamAuditor()
	g.teamBoxAuditor = newNullTeamBoxAuditor()
	g.stellar = newNullStellar(g)
	g.fullSelfer = NewUncachedFullSelf(g)
	g.ConnectivityMonitor = NullConnectivityMonitor{}
	g.localSigchainGuard = NewLocalSigchainGuard(g)
	g.MobileNetState = NewMobileNetState(g)
	g.MobileAppState = NewMobileAppState(g)
	g.DesktopAppState = NewDesktopAppState(g)
	g.RPCCanceler = NewRPCCanceler()
	g.IdentifyDispatch = NewIdentifyDispatch()
	g.Identify3State = NewIdentify3State(g)
	g.GregorState = newNullGregorState()

	g.Log.Debug("GlobalContext#Init(%p)\n", g)

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

func (g *GlobalContext) SetServiceSummaryMapper(u ServiceSummaryMapper) {
	g.ServiceMapper = u
}

func (g *GlobalContext) SetUIRouter(u UIRouter) {
	g.UIRouter = u
}

func (g *GlobalContext) SetDNSNameServerFetcher(d DNSNameServerFetcher) {
	g.DNSNSFetcher = d
}

func (g *GlobalContext) SetUPAKLoader(u UPAKLoader) {
	g.upakLoader = u
}

func (g *GlobalContext) SetAvatarLoader(a AvatarLoaderSource) {
	g.avatarLoader = a
}

// simulateServiceRestart simulates what happens when a service restarts for the
// purposes of testing.
func (g *GlobalContext) simulateServiceRestart() {
	defer g.switchUserMu.Acquire(NewMetaContext(context.TODO(), g), "simulateServiceRestart")()
	_ = g.ActiveDevice.Clear()
}

// ConfigureLogging should be given non-nil Usage if called by the main
// service.
func (g *GlobalContext) ConfigureLogging(usage *Usage) error {
	style := g.Env.GetLogFormat()
	debug := g.Env.GetDebug()

	logFile, ok := g.Env.GetEffectiveLogFile()
	// Configure regardless if the logFile should be used or not
	g.Log.Configure(style, debug, logFile)

	// Start redirecting logs if the logFile should be used
	// If this is not called, prints logs to stdout.
	if ok {
		err := logger.SetLogFileConfig(g.Env.GetLogFileConfig(logFile))
		if err != nil {
			return err
		}
	}
	g.Output = os.Stdout
	g.VDL.Configure(g.Env.GetVDebugSetting())

	shouldConfigureGUILog := true
	if usage != nil && usage.AllowRoot {
		isAdmin, _, err := IsSystemAdminUser()
		if err == nil && isAdmin {
			shouldConfigureGUILog = false
		}
	}

	if shouldConfigureGUILog {
		g.initGUILogFile()
	}

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
	g.Env.SetConfig(c, c)
	return nil
}

func (g *GlobalContext) ConfigReload() error {
	err := g.ConfigureConfig()
	if err != nil {
		return err
	}
	guiConfigErr := g.ConfigureGUIConfig()
	if guiConfigErr != nil {
		g.Log.Debug("Failed to open gui config: %s", guiConfigErr)
	}
	return g.ConfigureUpdaterConfig()
}

// migrateGUIConfig does not delete old values from service's config.
func migrateGUIConfig(serviceConfig ConfigReader, guiConfig *JSONFile) error {
	var errs []error

	p := "ui.routeState2"
	if uiRouteState2, isSet := serviceConfig.GetStringAtPath(p); isSet {
		if err := guiConfig.SetStringAtPath(p, uiRouteState2); err != nil {
			errs = append(errs, err)
		}
	}

	p = "ui.shownMonsterPushPrompt"
	if uiMonsterStorage, isSet := serviceConfig.GetBoolAtPath(p); isSet {
		if err := guiConfig.SetBoolAtPath(p, uiMonsterStorage); err != nil {
			errs = append(errs, err)
		}
	}

	p = "stellar.lastSentXLM"
	if stellarLastSentXLM, isSet := serviceConfig.GetBoolAtPath(p); isSet {
		if err := guiConfig.SetBoolAtPath(p, stellarLastSentXLM); err != nil {
			errs = append(errs, err)
		}
	}

	p = "ui.importContacts"
	syncSettings, err := serviceConfig.GetInterfaceAtPath(p)
	if err != nil {
		if !isJSONNoSuchKeyError(err) {
			errs = append(errs, err)
		}
	} else {
		syncSettings, ok := syncSettings.(map[string]interface{})
		if !ok {
			errs = append(errs, fmt.Errorf("Failed to coerce ui.importContacts in migration"))
		} else {
			for username, syncEnabled := range syncSettings {
				syncEnabled, ok := syncEnabled.(bool)
				if !ok {
					errs = append(errs, fmt.Errorf("Failed to coerce syncEnabled in migration for %s", username))
				}
				err := guiConfig.SetBoolAtPath(fmt.Sprintf("%s.%s", p, username), syncEnabled)
				if err != nil {
					errs = append(errs, err)
				}
			}
		}
	}
	return CombineErrors(errs...)
}

func (g *GlobalContext) ConfigureGUIConfig() error {
	guiConfig := NewJSONFile(g, g.Env.GetGUIConfigFilename(), "gui config")
	found, err := guiConfig.LoadCheckFound()
	if err == nil {
		if !found {
			err := guiConfig.SetBoolAtPath("gui", true)
			if err != nil {
				return err
			}
			// If this is the first time creating this file, manually migrate
			// old GUI config values from the main config file best-effort.
			serviceConfig := g.Env.GetConfig()
			if migrateErr := migrateGUIConfig(serviceConfig, guiConfig); migrateErr != nil {
				g.Log.Debug("Failed to migrate config to new GUI config file: %s", migrateErr)
			}

		}
		g.Env.SetGUIConfig(guiConfig)
	}
	return err
}

func (g *GlobalContext) ConfigureUpdaterConfig() error {
	c := NewJSONUpdaterConfigFile(g)
	err := c.Load(false)
	if err == nil {
		g.Env.SetUpdaterConfig(c)
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

// shutdownCachesLocked shutdown any non-nil caches that have running goroutines
// in them. It can be called from either configureMemCachesLocked (via logout or flush),
// or via Shutdown. In either case, callers must hold g.cacheMu.
func (g *GlobalContext) shutdownCachesLocked() {

	// shutdown and nil out any existing caches.
	if g.trackCache != nil {
		g.trackCache.Shutdown()
	}
	if g.identify2Cache != nil {
		g.identify2Cache.Shutdown()
	}
	if g.linkCache != nil {
		g.linkCache.Shutdown()
	}
	if g.cardCache != nil {
		g.cardCache.Shutdown()
	}
}

func (g *GlobalContext) TrackCache() *TrackCache {
	g.cacheMu.Lock()
	defer g.cacheMu.Unlock()
	return g.trackCache
}

func (g *GlobalContext) Identify2Cache() Identify2Cacher {
	g.cacheMu.Lock()
	defer g.cacheMu.Unlock()
	return g.identify2Cache
}

func (g *GlobalContext) CardCache() *UserCardCache {
	g.cacheMu.Lock()
	defer g.cacheMu.Unlock()
	return g.cardCache
}

func (g *GlobalContext) LinkCache() *LinkCache {
	g.cacheMu.Lock()
	defer g.cacheMu.Unlock()
	return g.linkCache
}

func (g *GlobalContext) configureMemCachesLocked(isFlush bool) {

	g.shutdownCachesLocked()

	g.IDLocktab = NewLockTable()
	g.loadUserLockTab = NewLockTable()
	g.Resolver.EnableCaching(NewMetaContextBackground(g))
	g.trackCache = NewTrackCache()
	g.identify2Cache = NewIdentify2Cache(g.Env.GetUserCacheMaxAge())
	g.Log.Debug("Created Identify2Cache, max age: %s", g.Env.GetUserCacheMaxAge())

	g.linkCache = NewLinkCache(g.Env.GetLinkCacheSize(), g.Env.GetLinkCacheCleanDur())
	g.Log.Debug("Created LinkCache, max size: %d, clean dur: %s", g.Env.GetLinkCacheSize(), g.Env.GetLinkCacheCleanDur())
	g.cardCache = NewUserCardCache(g.Env.GetUserCacheMaxAge())
	g.Log.Debug("Created CardCache, max age: %s", g.Env.GetUserCacheMaxAge())

	// If we're just flushing the caches, and already have a Proof cache, then the right idea
	// is just to reset what's in the ProofCache. Otherwise, we make a new one.
	if isFlush && g.ProofCache != nil {
		_ = g.ProofCache.Reset()
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
	g.TeamRoleMapManager.FlushCache()
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

func (g *GlobalContext) GetFastTeamLoader() FastTeamLoader {
	g.cacheMu.RLock()
	defer g.cacheMu.RUnlock()
	return g.fastTeamLoader
}

func (g *GlobalContext) GetHiddenTeamChainManager() HiddenTeamChainManager {
	g.cacheMu.RLock()
	defer g.cacheMu.RUnlock()
	return g.hiddenTeamChainManager
}

func (g *GlobalContext) GetTeamRoleMapManager() TeamRoleMapManager {
	g.cacheMu.RLock()
	defer g.cacheMu.RUnlock()
	return g.TeamRoleMapManager
}

func (g *GlobalContext) SetTeamRoleMapManager(r TeamRoleMapManager) {
	g.cacheMu.Lock()
	defer g.cacheMu.Unlock()
	g.TeamRoleMapManager = r
}

func (g *GlobalContext) SetHiddenTeamChainManager(h HiddenTeamChainManager) {
	g.cacheMu.Lock()
	defer g.cacheMu.Unlock()
	g.hiddenTeamChainManager = h
}

func (g *GlobalContext) GetTeamAuditor() TeamAuditor {
	g.cacheMu.RLock()
	defer g.cacheMu.RUnlock()
	return g.teamAuditor
}

func (g *GlobalContext) GetTeamBoxAuditor() TeamBoxAuditor {
	g.cacheMu.RLock()
	defer g.cacheMu.RUnlock()
	return g.teamBoxAuditor
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

func (g *GlobalContext) GetTeambotEKBoxStorage() TeamEKBoxStorage {
	g.cacheMu.RLock()
	defer g.cacheMu.RUnlock()
	return g.teambotEKBoxStorage
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

func (g *GlobalContext) GetImplicitTeamCacher() MemLRUer {
	g.cacheMu.RLock()
	defer g.cacheMu.RUnlock()
	return g.iteamCacher
}

func (g *GlobalContext) SetImplicitTeamCacher(l MemLRUer) {
	g.cacheMu.RLock()
	defer g.cacheMu.RUnlock()
	g.iteamCacher = l
}

func (g *GlobalContext) GetKVRevisionCache() KVRevisionCacher {
	g.cacheMu.RLock()
	defer g.cacheMu.RUnlock()
	return g.kvRevisionCache
}

func (g *GlobalContext) SetKVRevisionCache(kvr KVRevisionCacher) {
	g.cacheMu.RLock()
	defer g.cacheMu.RUnlock()
	g.kvRevisionCache = kvr
}

func (g *GlobalContext) GetFullSelfer() FullSelfer {
	g.cacheMu.RLock()
	defer g.cacheMu.RUnlock()
	return g.fullSelfer
}

func (g *GlobalContext) GetParamProofStore() MerkleStore {
	return g.paramProofStore
}

func (g *GlobalContext) GetExternalURLStore() MerkleStore {
	return g.externalURLStore
}

// to implement ProofContext
func (g *GlobalContext) GetPvlSource() MerkleStore {
	return g.pvlSource
}

// to implement ProofContext
func (g *GlobalContext) GetAppType() AppType {
	return g.Env.GetAppType()
}

func (g *GlobalContext) IsMobileAppType() bool {
	return g.Env.GetAppType() == MobileAppType
}

func (g *GlobalContext) ConfigureExportedStreams() error {
	g.XStreams = NewExportedStreams()
	return nil
}

// Shutdown is called exactly once per-process and does whatever
// cleanup is necessary to shut down the server.
func (g *GlobalContext) Shutdown(mctx MetaContext) error {
	var err error
	didShutdown := false

	// Wrap in a Once.Do so that we don't inadvertedly
	// run this code twice.
	g.shutdownOnce.Do(func() {
		g.Log.Debug("GlobalContext#Shutdown(%p)\n", g)
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

		// Shutdown can still race with Logout, so make sure that we hold onto
		// the cacheMu before shutting down the caches. See comments in
		// shutdownCachesLocked
		g.cacheMu.Lock()
		g.shutdownCachesLocked()
		g.cacheMu.Unlock()

		if g.Resolver != nil {
			g.Resolver.Shutdown(NewMetaContextBackground(g))
		}

		for _, hook := range g.ShutdownHooks {
			epick.Push(hook(mctx))
		}

		// shutdown the databases after the shutdown hooks run, we may want to
		// flush memory caches to disk during shutdown.
		if g.LocalDb != nil {
			epick.Push(g.LocalDb.Close())
		}
		if g.LocalChatDb != nil {
			epick.Push(g.LocalChatDb.Close())
		}
		if g.GUILogFile != nil {
			epick.Push(g.GUILogFile.Close())
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

// If changed, make sure to correct standalone usage in g.Configure below
var ServiceUsage = Usage{
	Config:     true,
	KbKeyring:  true,
	GpgKeyring: true,
	API:        true,
	Socket:     true,
}

func (g *GlobalContext) ConfigureCommand(line CommandLine, cmd Command) error {
	usage := cmd.GetUsage()
	return g.Configure(line, usage)
}

func (g *GlobalContext) Configure(line CommandLine, usage Usage) error {
	g.SetCommandLine(line)

	if err := g.ConfigureLogging(&usage); err != nil {
		return err
	}
	if g.Env.GetStandalone() {
		// If standalone, override the usage to be the same as in a service
		// If changed, make sure to correct ServiceUsage above.
		usage.Config = ServiceUsage.Config
		usage.KbKeyring = ServiceUsage.KbKeyring
		usage.GpgKeyring = ServiceUsage.GpgKeyring
		usage.API = ServiceUsage.API
		usage.Socket = ServiceUsage.Socket
	}

	if err := g.ConfigureUsage(usage); err != nil {
		return err
	}

	// secretStore must be created after SetCommandLine and ConfigureUsage in
	// order to correctly use -H,-home flag and config vars for
	// remember_passphrase.
	g.secretStoreMu.Lock()
	g.secretStore = NewSecretStoreLocked(NewMetaContextBackground(g))
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
	_, _ = g.Output.Write([]byte(s))
}

func (g *GlobalContext) OutputBytes(b []byte) {
	_, _ = g.Output.Write(b)
}

func (g *GlobalContext) GetGpgClient() *GpgCLI {
	if g.GpgClient == nil {
		g.GpgClient = NewGpgCLI(g, nil)
	}
	return g.GpgClient
}

func (g *GlobalContext) GetMyUID() keybase1.UID {
	// Prefer ActiveDevice, that's the prefered way
	// to figure out what the current user's UID is.
	uid := g.ActiveDevice.UID()
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

func (g *GlobalContext) GetConfiguredAccounts(ctx context.Context) ([]keybase1.ConfiguredAccount, error) {
	m := NewMetaContext(ctx, g)
	g.secretStoreMu.Lock()
	defer g.secretStoreMu.Unlock()
	return GetConfiguredAccounts(m, g.secretStore)
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

func (g *GlobalContext) GetUsersWithStoredSecrets(ctx context.Context) ([]string, error) {
	g.secretStoreMu.Lock()
	defer g.secretStoreMu.Unlock()
	if g.secretStore != nil {
		return g.secretStore.GetUsersWithStoredSecrets(NewMetaContext(ctx, g))
	}
	return []string{}, nil
}

func (g *GlobalContext) GetCacheDir() string {
	return g.Env.GetCacheDir()
}

func (g *GlobalContext) GetSharedCacheDir() string {
	return g.Env.GetSharedCacheDir()
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
	g.Log.Debug("AddLoginHook: %T", hook)
	g.loginHooks = append(g.loginHooks, hook)
}

func (g *GlobalContext) CallLoginHooks(mctx MetaContext) {
	mctx.Debug("G#CallLoginHooks")

	// Trigger the creation of a per-user-keyring
	_, _ = g.GetPerUserKeyring(mctx.Ctx())

	mctx.Debug("CallLoginHooks: running UPAK#LoginAs")
	err := g.GetUPAKLoader().LoginAs(mctx.CurrentUID())
	if err != nil {
		mctx.Warning("LoginAs error: %+v", err)
	}

	// Do so outside the lock below
	mctx.Debug("CallLoginHooks: running FullSelfer#OnLogin")
	err = g.GetFullSelfer().OnLogin(mctx)
	if err != nil {
		mctx.Warning("OnLogin full self error: %+v", err)
	}

	mctx.Debug("CallLoginHooks: recording login in secretstore")
	err = RecordLoginTime(mctx, g.Env.GetUsername())
	if err != nil {
		mctx.Warning("OnLogin RecordLogin error: %+v", err)
	}

	mctx.Debug("CallLoginHooks: running registered login hooks")
	g.hookMu.RLock()
	defer g.hookMu.RUnlock()
	for _, h := range g.loginHooks {
		mctx.Debug("CallLoginHooks: will call login hook for %T", h)
	}
	for _, h := range g.loginHooks {
		mctx.Debug("CallLoginHooks: calling login hook for %T", h)
		if err := h.OnLogin(mctx); err != nil {
			mctx.Warning("OnLogin hook error: %s", err)
		}
	}
}

type NamedLogoutHook struct {
	LogoutHook
	name string
}

func (g *GlobalContext) AddLogoutHook(hook LogoutHook, name string) {
	g.hookMu.Lock()
	defer g.hookMu.Unlock()
	g.logoutHooks = append(g.logoutHooks, NamedLogoutHook{
		LogoutHook: hook,
		name:       name,
	})
}

func (g *GlobalContext) CallLogoutHooks(mctx MetaContext) {
	defer mctx.TraceTimed("GlobalContext.CallLogoutHooks", func() error { return nil })()
	g.hookMu.RLock()
	defer g.hookMu.RUnlock()
	for _, h := range g.logoutHooks {
		mctx.Debug("+ Logout hook [%v]", h.name)
		if err := h.OnLogout(mctx); err != nil {
			mctx.Warning("| Logout hook [%v] : %s", h.name, err)
		}
		mctx.Debug("- Logout hook [%v]", h.name)
	}
}

type NamedDbNukeHook struct {
	DbNukeHook
	name string
}

func (g *GlobalContext) AddDbNukeHook(hook DbNukeHook, name string) {
	g.hookMu.Lock()
	defer g.hookMu.Unlock()
	g.dbNukeHooks = append(g.dbNukeHooks, NamedDbNukeHook{
		DbNukeHook: hook,
		name:       name,
	})
}

func (g *GlobalContext) CallDbNukeHooks(mctx MetaContext) {
	defer mctx.TraceTimed("GlobalContext.CallDbNukeHook", func() error { return nil })()
	g.hookMu.RLock()
	defer g.hookMu.RUnlock()
	for _, h := range g.dbNukeHooks {
		mctx.Debug("+ DbNukeHook hook [%v]", h.name)
		if err := h.OnDbNuke(mctx); err != nil {
			mctx.Warning("| DbNukeHook hook [%v] : %s", h.name, err)
		}
		mctx.Debug("- DbNukeHook hook [%v]", h.name)
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

func (g *GlobalContext) MakeAssertionContext(mctx MetaContext) AssertionContext {
	g.cacheMu.Lock()
	defer g.cacheMu.Unlock()
	if g.proofServices == nil {
		return nil
	}
	return MakeAssertionContext(mctx, g.proofServices)
}

func (g *GlobalContext) SetProofServices(s ExternalServicesCollector) {
	g.cacheMu.Lock()
	defer g.cacheMu.Unlock()
	g.proofServices = s
}

func (g *GlobalContext) SetParamProofStore(s MerkleStore) {
	g.cacheMu.Lock()
	defer g.cacheMu.Unlock()
	g.paramProofStore = s
}

func (g *GlobalContext) SetExternalURLStore(s MerkleStore) {
	g.cacheMu.Lock()
	defer g.cacheMu.Unlock()
	g.externalURLStore = s
}

func (g *GlobalContext) SetPvlSource(s MerkleStore) {
	g.cacheMu.Lock()
	defer g.cacheMu.Unlock()
	g.pvlSource = s
}

func (g *GlobalContext) SetTeamLoader(l TeamLoader) {
	g.cacheMu.Lock()
	defer g.cacheMu.Unlock()
	g.teamLoader = l
}

func (g *GlobalContext) SetMerkleClient(m MerkleClientInterface) {
	g.cacheMu.Lock()
	defer g.cacheMu.Unlock()
	g.MerkleClient = m
}

func (g *GlobalContext) GetMerkleClient() MerkleClientInterface {
	g.cacheMu.Lock()
	defer g.cacheMu.Unlock()
	return g.MerkleClient
}

func (g *GlobalContext) SetFastTeamLoader(l FastTeamLoader) {
	g.cacheMu.Lock()
	defer g.cacheMu.Unlock()
	g.fastTeamLoader = l
}

func (g *GlobalContext) SetTeamAuditor(a TeamAuditor) {
	g.cacheMu.Lock()
	defer g.cacheMu.Unlock()
	g.teamAuditor = a
}

func (g *GlobalContext) SetTeamBoxAuditor(a TeamBoxAuditor) {
	g.cacheMu.Lock()
	defer g.cacheMu.Unlock()
	g.teamBoxAuditor = a
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

func (g *GlobalContext) SetTeambotEKBoxStorage(s TeamEKBoxStorage) {
	g.cacheMu.Lock()
	defer g.cacheMu.Unlock()
	g.teambotEKBoxStorage = s
}

func (g *GlobalContext) LoadUserByUID(uid keybase1.UID) (*User, error) {
	arg := NewLoadUserArgWithMetaContext(NewMetaContextBackground(g)).WithUID(uid).WithPublicKeyOptional()
	return LoadUser(arg)
}

func (g *GlobalContext) BustLocalUserCache(ctx context.Context, u keybase1.UID) {
	g.GetUPAKLoader().Invalidate(ctx, u)
	_ = g.CardCache().Delete(u)
	_ = g.GetFullSelfer().HandleUserChanged(u)
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

func (g *GlobalContext) KeyfamilyChanged(ctx context.Context, u keybase1.UID) {
	g.Log.CDebugf(ctx, "+ KeyfamilyChanged(%s)", u)
	defer g.Log.CDebugf(ctx, "- KeyfamilyChanged(%s)", u)

	// Make sure we kill the UPAK and full self cache for this user
	g.BustLocalUserCache(ctx, u)

	if g.NotifyRouter != nil {
		g.NotifyRouter.HandleKeyfamilyChanged(u)
		// TODO: remove this when KBFS handles KeyfamilyChanged
		g.NotifyRouter.HandleUserChanged(NewMetaContext(ctx, g), u, "KeyfamilyChanged")
	}
}

func (g *GlobalContext) UserChanged(ctx context.Context, u keybase1.UID) {
	g.Log.CDebugf(ctx, "+ UserChanged(%s)", u)
	defer g.Log.CDebugf(ctx, "- UserChanged(%s)", u)

	_, _ = g.GetPerUserKeyring(context.TODO())

	g.BustLocalUserCache(ctx, u)
	if g.NotifyRouter != nil {
		g.NotifyRouter.HandleUserChanged(NewMetaContext(ctx, g), u, "G.UserChanged")
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
func (g *GlobalContext) GetPerUserKeyring(ctx context.Context) (ret *PerUserKeyring, err error) {
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
			g.Log.CWarningf(ctx, "G#GetPerUserKeyring -> failed: %s", err)
			g.perUserKeyring = nil
			return nil, err
		}
		g.Log.CDebugf(ctx, "G#GetPerUserKeyring -> new")
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

	_ = g.StandaloneChatConnector.StartStandaloneChat(g)
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
func (g *GlobalContext) ReplaceSecretStore(ctx context.Context) error {
	g.secretStoreMu.Lock()
	defer g.secretStoreMu.Unlock()

	username := g.Env.GetUsername()
	m := NewMetaContext(ctx, g)

	// get the current secret
	secret, err := g.secretStore.RetrieveSecret(m, username)
	if err != nil {
		m.Debug("error retrieving existing secret for ReplaceSecretStore: %s", err)
		return err
	}

	// clear the existing secret from the existing secret store
	if err := g.secretStore.ClearSecret(m, username); err != nil {
		m.Debug("error clearing existing secret for ReplaceSecretStore: %s", err)
		return err
	}

	// make a new secret store
	g.secretStore = NewSecretStoreLocked(m)

	// store the secret in the secret store
	if err := g.secretStore.StoreSecret(m, username, secret); err != nil {
		m.Debug("error storing existing secret for ReplaceSecretStore: %s", err)
		return err
	}

	m.Debug("ReplaceSecretStore success")

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
	res = g.ActiveDevice.UserVersion()
	if res.IsNil() {
		return keybase1.UserVersion{}, LoginRequiredError{}
	}
	return res, nil
}
