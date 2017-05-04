// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
)

const (
	// InitDefaultString is the normal mode for when KBFS data will be
	// read and written.
	InitDefaultString string = "default"
	// InitMinimalString is for when KBFS will only be used as a MD
	// lookup layer (e.g., for chat on mobile).
	InitMinimalString = "minimal"
)

// InitParams contains the initialization parameters for Init(). It is
// usually filled in by the flags parser passed into AddFlags().
type InitParams struct {
	// Whether to print debug messages.
	Debug bool

	// If non-empty, the host:port of the block server. If empty,
	// a default value is used depending on the run mode. Can also
	// be "memory" for an in-memory test server or
	// "dir:/path/to/dir" for an on-disk test server.
	BServerAddr string

	// If non-empty the host:port of the metadata server. If
	// empty, a default value is used depending on the run mode.
	// Can also be "memory" for an in-memory test server or
	// "dir:/path/to/dir" for an on-disk test server.
	MDServerAddr string

	// If non-zero, specifies the capacity (in bytes) of the block cache. If
	// zero, the capacity is set using getDefaultBlockCacheCapacity().
	CleanBlockCacheCapacity uint64

	// Fake local user name.
	LocalUser string

	// Where to put favorites. Has an effect only when LocalUser
	// is non-empty, in which case it must be either "memory" or
	// "dir:/path/to/dir".
	LocalFavoriteStorage string

	// TLFValidDuration is the duration that TLFs are valid
	// before marked for lazy revalidation.
	TLFValidDuration time.Duration

	// MetadataVersion is the default version of metadata to use
	// when creating new metadata.
	MetadataVersion MetadataVer

	// LogToFile if true, logs to a default file location.
	LogToFile bool

	// LogFileConfig tells us where to log and rotation config.
	LogFileConfig logger.LogFileConfig

	// TLFJournalBackgroundWorkStatus is the status to use to
	// pass into JournalServer.enableJournaling. Only has an effect when
	// EnableJournal is non-empty.
	TLFJournalBackgroundWorkStatus TLFJournalBackgroundWorkStatus

	// CreateSimpleFSInstance creates a SimpleFSInterface from config.
	// If this is nil then simplefs will be omitted in the rpc api.
	CreateSimpleFSInstance func(Config) keybase1.SimpleFSInterface

	// EnableJournal enables journaling.
	EnableJournal bool

	// EnableDiskCache toggles whether the disk cache is enabled in the
	// StorageRoot data directory.
	EnableDiskCache bool

	// StorageRoot, if non-empty, points to a local directory to put its local
	// databases for things like the journal or disk cache.
	StorageRoot string

	// BGFlushPeriod indicates how long to wait for a batch to fill up
	// before syncing a set of changes on a TLF to the servers.
	BGFlushPeriod time.Duration

	// BGFlushDirOpBatchSize indicates how many directory operations
	// in a TLF should be batched together in a single background
	// flush.
	BGFlushDirOpBatchSize int

	// Mode describes how KBFS should initialize itself.
	Mode string
}

// defaultBServer returns the default value for the -bserver flag.
func defaultBServer(ctx Context) string {
	switch ctx.GetRunMode() {
	case libkb.DevelRunMode:
		return memoryAddr
	case libkb.StagingRunMode:
		return "bserver.dev.keybase.io:443"
	case libkb.ProductionRunMode:
		return "bserver.kbfs.keybase.io:443"
	default:
		return ""
	}
}

// defaultMDServer returns the default value for the -mdserver flag.
func defaultMDServer(ctx Context) string {
	switch ctx.GetRunMode() {
	case libkb.DevelRunMode:
		return memoryAddr
	case libkb.StagingRunMode:
		return "mdserver.dev.keybase.io:443"
	case libkb.ProductionRunMode:
		return "mdserver.kbfs.keybase.io:443"
	default:
		return ""
	}
}

// defaultMetadataVersion returns the default metadata version per run mode.
func defaultMetadataVersion(ctx Context) MetadataVer {
	switch ctx.GetRunMode() {
	case libkb.DevelRunMode:
		return SegregatedKeyBundlesVer
	case libkb.StagingRunMode:
		return SegregatedKeyBundlesVer
	case libkb.ProductionRunMode:
		return SegregatedKeyBundlesVer
	default:
		return SegregatedKeyBundlesVer
	}
}

func defaultLogPath(ctx Context) string {
	return filepath.Join(ctx.GetLogDir(), libkb.KBFSLogFileName)
}

// DefaultInitParams returns default init params
func DefaultInitParams(ctx Context) InitParams {
	return InitParams{
		Debug:            BoolForString(os.Getenv("KBFS_DEBUG")),
		BServerAddr:      defaultBServer(ctx),
		MDServerAddr:     defaultMDServer(ctx),
		TLFValidDuration: tlfValidDurationDefault,
		MetadataVersion:  defaultMetadataVersion(ctx),
		LogFileConfig: logger.LogFileConfig{
			MaxAge:       30 * 24 * time.Hour,
			MaxSize:      128 * 1024 * 1024,
			MaxKeepFiles: 3,
		},
		TLFJournalBackgroundWorkStatus: TLFJournalBackgroundWorkEnabled,
		StorageRoot:                    ctx.GetDataDir(),
		BGFlushPeriod:                  bgFlushPeriodDefault,
		BGFlushDirOpBatchSize:          bgFlushDirOpBatchSizeDefault,
		Mode: InitDefaultString,
	}
}

// AddFlags adds libkbfs flags to the given FlagSet. Returns an
// InitParams that will be filled in once the given FlagSet is parsed.
func AddFlags(flags *flag.FlagSet, ctx Context) *InitParams {
	defaultParams := DefaultInitParams(ctx)

	var params InitParams
	flags.BoolVar(&params.Debug, "debug", defaultParams.Debug,
		"Print debug messages")

	flags.StringVar(&params.BServerAddr, "bserver", defaultParams.BServerAddr,
		"host:port of the block server, 'memory', or 'dir:/path/to/dir'")
	flags.StringVar(&params.MDServerAddr, "mdserver",
		defaultParams.MDServerAddr,
		"host:port of the metadata server, 'memory', or 'dir:/path/to/dir'")
	flags.StringVar(&params.LocalUser, "localuser", defaultParams.LocalUser,
		"fake local user")
	flags.StringVar(&params.LocalFavoriteStorage, "local-fav-storage",
		defaultParams.LocalFavoriteStorage,
		"where to put favorites; used only when -localuser is set, then must "+
			"either be 'memory' or 'dir:/path/to/dir'")
	flags.DurationVar(&params.TLFValidDuration, "tlf-valid",
		defaultParams.TLFValidDuration,
		"time tlfs are valid before redoing identification")
	flags.BoolVar(&params.LogToFile, "log-to-file", false,
		fmt.Sprintf("Log to default file: %s", defaultLogPath(ctx)))
	flags.StringVar(&params.LogFileConfig.Path, "log-file", "",
		"Path to log file")
	flags.DurationVar(&params.LogFileConfig.MaxAge, "log-file-max-age",
		defaultParams.LogFileConfig.MaxAge,
		"Maximum age of a log file before rotation")
	params.LogFileConfig.MaxSize = defaultParams.LogFileConfig.MaxSize
	flags.Var(SizeFlag{&params.LogFileConfig.MaxSize}, "log-file-max-size",
		"Maximum size of a log file before rotation")
	// The default is to *DELETE* old log files for kbfs.
	flags.IntVar(&params.LogFileConfig.MaxKeepFiles, "log-file-max-keep-files",
		defaultParams.LogFileConfig.MaxKeepFiles, "Maximum number of log "+
			"files for this service, older ones are deleted. 0 for infinite.")
	flags.Uint64Var(&params.CleanBlockCacheCapacity, "clean-bcache-cap",
		defaultParams.CleanBlockCacheCapacity,
		"If non-zero, specify the capacity of clean block cache. If zero, "+
			"the capacity is set based on system RAM.")
	flags.StringVar(&params.StorageRoot, "storage-root",
		defaultParams.StorageRoot, "Specifies where Keybase will store its "+
			"local databases for the journal and disk cache.")
	flags.BoolVar(&params.EnableDiskCache, "enable-disk-cache", true,
		"Enables the disk cache for the directory specified "+
			"by -storage-root.")
	flags.BoolVar(&params.EnableJournal, "enable-journal", true, "Enables "+
		"write journaling for TLFs.")

	// No real need to enable setting
	// params.TLFJournalBackgroundWorkStatus via a flag.
	params.TLFJournalBackgroundWorkStatus =
		defaultParams.TLFJournalBackgroundWorkStatus

	flags.DurationVar(&params.BGFlushPeriod, "sync-batch-period",
		defaultParams.BGFlushPeriod,
		"The amount of time to wait before syncing data in a TLF, if the "+
			"batch size doesn't fill up.")
	flags.IntVar((*int)(&params.BGFlushDirOpBatchSize), "sync-batch-size",
		int(defaultParams.BGFlushDirOpBatchSize),
		"The number of unflushed directory operations in a TLF that will "+
			"trigger an immediate data sync.  EXPERIMENTAL, only "+
			"available for Keybase admins")

	flags.IntVar((*int)(&params.MetadataVersion), "md-version",
		int(defaultParams.MetadataVersion),
		"Metadata version to use when creating new metadata")
	flags.StringVar(&params.Mode, "mode", InitDefaultString,
		fmt.Sprintf("Overall initialization mode for KBFS, indicating how "+
			"heavy-weight it can be (%s or %s)", InitDefaultString,
			InitMinimalString))

	return &params
}

// GetRemoteUsageString returns a string describing the flags to use
// to run against remote KBFS servers.
func GetRemoteUsageString() string {
	return `    [-debug]
    [-bserver=host:port] [-mdserver=host:port]
    [-log-to-file] [-log-file=path/to/file] [-clean-bcache-cap=0]`
}

// GetLocalUsageString returns a string describing the flags to use to
// run in a local testing environment.
func GetLocalUsageString() string {
	return `    [-debug]
    [-bserver=(memory | dir:/path/to/dir | host:port)]
    [-mdserver=(memory | dir:/path/to/dir | host:port)]
    [-localuser=<user>]
    [-local-fav-storage=(memory | dir:/path/to/dir)]
    [-log-to-file] [-log-file=path/to/file] [-clean-bcache-cap=0]`
}

// GetDefaultsUsageString returns a string describing the default
// values of flags based on the run mode.
func GetDefaultsUsageString(ctx Context) string {
	runMode := ctx.GetRunMode()
	defaultBServer := defaultBServer(ctx)
	defaultMDServer := defaultMDServer(ctx)
	return fmt.Sprintf(`  (KEYBASE_RUN_MODE=%s)
  -bserver=%s
  -mdserver=%s`,
		runMode, defaultBServer, defaultMDServer)
}

const memoryAddr = "memory"

const dirAddrPrefix = "dir:"

func parseRootDir(addr string) (string, bool) {
	if !strings.HasPrefix(addr, dirAddrPrefix) {
		return "", false
	}
	serverRootDir := addr[len(dirAddrPrefix):]
	if len(serverRootDir) == 0 {
		return "", false
	}
	return serverRootDir, true
}

func makeMDServer(config Config, mdserverAddr string,
	rpcLogFactory *libkb.RPCLogFactory, log logger.Logger) (
	MDServer, error) {
	if mdserverAddr == memoryAddr {
		log.Debug("Using in-memory mdserver")
		// local in-memory MD server
		return NewMDServerMemory(mdServerLocalConfigAdapter{config})
	}

	if len(mdserverAddr) == 0 {
		return nil, errors.New("Empty MD server address")
	}

	if serverRootDir, ok := parseRootDir(mdserverAddr); ok {
		log.Debug("Using on-disk mdserver at %s", serverRootDir)
		// local persistent MD server
		mdPath := filepath.Join(serverRootDir, "kbfs_md")
		return NewMDServerDir(mdServerLocalConfigAdapter{config}, mdPath)
	}

	// remote MD server. this can't fail. reconnection attempts
	// will be automatic.
	log.Debug("Using remote mdserver %s", mdserverAddr)
	mdServer := NewMDServerRemote(config, mdserverAddr, rpcLogFactory)
	return mdServer, nil
}

func makeKeyServer(config Config, keyserverAddr string,
	log logger.Logger) (KeyServer, error) {
	if keyserverAddr == memoryAddr {
		log.Debug("Using in-memory keyserver")
		// local in-memory key server
		return NewKeyServerMemory(config)
	}

	if len(keyserverAddr) == 0 {
		return nil, errors.New("Empty key server address")
	}

	if serverRootDir, ok := parseRootDir(keyserverAddr); ok {
		log.Debug("Using on-disk keyserver at %s", serverRootDir)
		// local persistent key server
		keyPath := filepath.Join(serverRootDir, "kbfs_key")
		return NewKeyServerDir(config, keyPath)
	}

	log.Debug("Using remote keyserver %s (same as mdserver)", keyserverAddr)
	// currently the MD server also acts as the key server.
	keyServer, ok := config.MDServer().(KeyServer)
	if !ok {
		return nil, errors.New("MD server is not a key server")
	}
	return keyServer, nil
}

func makeBlockServer(config Config, bserverAddr string,
	rpcLogFactory *libkb.RPCLogFactory,
	log logger.Logger) (BlockServer, error) {
	if bserverAddr == memoryAddr {
		log.Debug("Using in-memory bserver")
		bserverLog := config.MakeLogger("BSM")
		// local in-memory block server
		return NewBlockServerMemory(bserverLog), nil
	}

	if len(bserverAddr) == 0 {
		return nil, errors.New("Empty block server address")
	}

	if serverRootDir, ok := parseRootDir(bserverAddr); ok {
		log.Debug("Using on-disk bserver at %s", serverRootDir)
		// local persistent block server
		blockPath := filepath.Join(serverRootDir, "kbfs_block")
		bserverLog := config.MakeLogger("BSD")
		return NewBlockServerDir(config.Codec(),
			bserverLog, blockPath), nil
	}

	log.Debug("Using remote bserver %s", bserverAddr)
	return NewBlockServerRemote(config, bserverAddr, rpcLogFactory), nil
}

// InitLog sets up logging switching to a log file if necessary.
// Returns a valid logger even on error, which are non-fatal, thus
// errors from this function may be ignored.
// Possible errors are logged to the logger returned.
func InitLog(params InitParams, ctx Context) (logger.Logger, error) {
	var err error
	log := logger.NewWithCallDepth("kbfs", 1)

	// Set log file to default if log-to-file was specified
	if params.LogToFile {
		if params.LogFileConfig.Path != "" {
			return nil, fmt.Errorf(
				"log-to-file and log-file flags can't be specified together")
		}
		params.LogFileConfig.Path = defaultLogPath(ctx)
	}

	if params.LogFileConfig.Path != "" {
		err = logger.SetLogFileConfig(&params.LogFileConfig)
	}

	log.Configure("", params.Debug, "")
	log.Info("KBFS version %s", VersionString())

	if err != nil {
		log.Warning("Failed to setup log file %q: %+v",
			params.LogFileConfig.Path, err)
	}

	return log, err
}

// Init initializes a config and returns it.
//
// onInterruptFn is called whenever an interrupt signal is received
// (e.g., if the user hits Ctrl-C).
//
// Init should be called at the beginning of main. Shutdown (see
// below) should then be called at the end of main (usually via
// defer).
//
// The keybaseServiceCn argument is to specify a custom service and
// crypto (for non-RPC environments) like mobile. If this is nil, we'll
// use the default RPC implementation.
func Init(ctx Context, params InitParams, keybaseServiceCn KeybaseServiceCn,
	onInterruptFn func(), log logger.Logger) (cfg Config, err error) {
	done := make(chan struct{})
	interruptChan := make(chan os.Signal, 1)
	signal.Notify(interruptChan, os.Interrupt)
	go func() {
		_ = <-interruptChan

		close(done)

		if onInterruptFn != nil {
			onInterruptFn()

			// Unmount can fail if there are open file handles. In
			// this case, the files need to be closed before calling
			// unmount again. We keep listening on the signal channel
			// in case unmount fails the first time, so user can press
			// Ctrl-C again after closing open files.
			//
			// Not closing the channel here because we need to keep it
			// open to handle further incoming signals. We don't
			// explicitly call os.Exit here so that the process exits
			// through normal workflow as a result of Ctrl-C.  If the
			// process needs to exit immediately no matter unmount
			// succeeds or not, a different interrupt (e.g. SIGTERM)
			// can be used to skip this.
			for range interruptChan {
				onInterruptFn()
			}
		}

	}()

	// Spawn a new goroutine for `doInit` so that we can `select` on
	// `done` and `errCh` below. This is particularly for the
	// situation where a SIGINT comes in while `doInit` is still not
	// finished (because e.g. service daemon is not up), where the
	// process can fail to exit while being stuck in `doInit`.  This
	// allows us to not call `os.Exit()` in the interrupt handler.
	errCh := make(chan error)
	go func() {
		var er error
		cfg, er = doInit(ctx, params, keybaseServiceCn, log)
		errCh <- er
	}()

	select {
	case <-done:
		return nil, errors.New(os.Interrupt.String())
	case err = <-errCh:
		return cfg, err
	}
}

func doInit(ctx Context, params InitParams, keybaseServiceCn KeybaseServiceCn,
	log logger.Logger) (Config, error) {
	mode := InitDefault
	switch params.Mode {
	case InitDefaultString:
		log.Debug("Initializing in default mode")
		// Already the default
	case InitMinimalString:
		log.Debug("Initializing in minimal mode")
		mode = InitMinimal
	default:
		return nil, fmt.Errorf("Unexpected mode: %s", params.Mode)
	}

	config := NewConfigLocal(mode, func(module string) logger.Logger {
		mname := "kbfs"
		if module != "" {
			mname += fmt.Sprintf("(%s)", module)
		}
		// Add log depth so that context-based messages get the right
		// file printed out.
		lg := logger.NewWithCallDepth(mname, 1)
		if params.Debug {
			// Turn on debugging.  TODO: allow a proper log file and
			// style to be specified.
			lg.Configure("", true, "")
		}
		return lg
	}, params.StorageRoot)

	if params.CleanBlockCacheCapacity > 0 {
		log.Debug("overriding default clean block cache capacity from %d to %d",
			config.BlockCache().GetCleanBytesCapacity(),
			params.CleanBlockCacheCapacity)
		config.BlockCache().SetCleanBytesCapacity(
			params.CleanBlockCacheCapacity)
	}

	workers := defaultBlockRetrievalWorkerQueueSize
	if config.Mode() == InitMinimal {
		// In minimal mode, a few workers are still needed to fetch
		// unembedded block changes in the MD updates, but not many.
		// TODO: turn off the block retriever entirely as part of
		// KBFS-2026, when block re-embedding is no longer required.
		workers = minimalBlockRetrievalWorkerQueueSize
	}
	config.SetBlockOps(NewBlockOpsStandard(config, workers))

	bsplitter, err := NewBlockSplitterSimple(MaxBlockSizeBytesDefault, 8*1024,
		config.Codec())
	if err != nil {
		return nil, err
	}
	config.SetBlockSplitter(bsplitter)

	if registry := config.MetricsRegistry(); registry != nil {
		keyCache := config.KeyCache()
		keyCache = NewKeyCacheMeasured(keyCache, registry)
		config.SetKeyCache(keyCache)

		keyBundleCache := config.KeyBundleCache()
		keyBundleCache = NewKeyBundleCacheMeasured(keyBundleCache, registry)
		config.SetKeyBundleCache(keyBundleCache)
	}

	config.SetMetadataVersion(MetadataVer(params.MetadataVersion))
	config.SetTLFValidDuration(params.TLFValidDuration)
	config.SetBGFlushPeriod(params.BGFlushPeriod)

	kbfsOps := NewKBFSOpsStandard(config)
	config.SetKBFSOps(kbfsOps)
	config.SetNotifier(kbfsOps)
	config.SetKeyManager(NewKeyManagerStandard(config))
	config.SetMDOps(NewMDOpsStandard(config))

	kbfsLog := config.MakeLogger("")

	if keybaseServiceCn == nil {
		keybaseServiceCn = keybaseDaemon{}
	}
	service, err := keybaseServiceCn.NewKeybaseService(
		config, params, ctx, kbfsLog)
	if err != nil {
		return nil, fmt.Errorf("problem creating service: %s", err)
	}

	if registry := config.MetricsRegistry(); registry != nil {
		service = NewKeybaseServiceMeasured(service, registry)
	}

	config.SetKeybaseService(service)

	k := NewKBPKIClient(config, kbfsLog)
	config.SetKBPKI(k)

	config.SetReporter(NewReporterKBPKI(config, 10, 1000))

	// crypto must be initialized before the MD and block servers
	// are initialized, since those depend on crypto.
	crypto, err := keybaseServiceCn.NewCrypto(config, params, ctx, kbfsLog)
	if err != nil {
		return nil, fmt.Errorf("problem creating crypto: %s", err)
	}

	if registry := config.MetricsRegistry(); registry != nil {
		crypto = NewCryptoMeasured(crypto, registry)
	}

	config.SetCrypto(crypto)

	mdServer, err := makeMDServer(
		config, params.MDServerAddr, ctx.NewRPCLogFactory(), log)
	if err != nil {
		return nil, fmt.Errorf("problem creating MD server: %+v", err)
	}
	config.SetMDServer(mdServer)

	// note: the mdserver is the keyserver at the moment.
	keyServer, err := makeKeyServer(config, params.MDServerAddr, log)
	if err != nil {
		return nil, fmt.Errorf("problem creating key server: %+v", err)
	}

	if registry := config.MetricsRegistry(); registry != nil {
		keyServer = NewKeyServerMeasured(keyServer, registry)
	}

	config.SetKeyServer(keyServer)

	bserv, err := makeBlockServer(
		config, params.BServerAddr, ctx.NewRPCLogFactory(), log)
	if err != nil {
		return nil, fmt.Errorf("cannot open block database: %+v", err)
	}

	if registry := config.MetricsRegistry(); registry != nil {
		bserv = NewBlockServerMeasured(bserv, registry)
	}

	config.SetBlockServer(bserv)

	_, err = config.EnableDiskLimiter(params.StorageRoot)
	if err != nil {
		log.Warning("Could not enable disk limiter: %+v", err)
		return nil, err
	}
	// TODO: Don't turn on journaling if either -bserver or
	// -mdserver point to local implementations.
	if params.EnableJournal && config.Mode() != InitMinimal {
		journalRoot := filepath.Join(params.StorageRoot, "kbfs_journal")
		err = config.EnableJournaling(context.Background(), journalRoot,
			params.TLFJournalBackgroundWorkStatus)
		if err != nil {
			log.Warning("Could not initialize journal server: %+v", err)
		}
		log.Debug("Journaling enabled")
	}
	if params.EnableDiskCache {
		dbc, err := newDiskBlockCacheStandard(config,
			diskBlockCacheRootFromStorageRoot(params.StorageRoot))
		if err != nil {
			log.Warning("Could not initialize disk cache: %+v", err)
			// TODO: Make this error less fatal later.
			return nil, err
		}
		config.SetDiskBlockCache(dbc)
		log.Debug("Disk cache enabled")
	}

	session, err := config.KBPKI().GetCurrentSession(context.Background())
	if err == nil && adminFeatureList[session.UID] {
		log.Debug("Enabling a dir op batch size of %d",
			params.BGFlushDirOpBatchSize)
		config.SetBGFlushDirOpBatchSize(params.BGFlushDirOpBatchSize)
	} else {
		// TODO: let non-admins have a non-1 batch size once admins
		// test it enough.
		config.SetBGFlushDirOpBatchSize(1)
	}

	return config, nil
}

// Shutdown does any necessary shutdown tasks for libkbfs. Shutdown
// should be called at the end of main.
func Shutdown() {}
