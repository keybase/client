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

	"github.com/keybase/client/go/kbconst"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
)

const (
	// InitDefaultString is the normal mode for when KBFS data will be
	// read and written.
	InitDefaultString string = "default"
	// InitMinimalString is for when KBFS will only be used as a MD
	// lookup layer (e.g., for chat on mobile).
	InitMinimalString = "minimal"
	// InitSingleOpString is for when KBFS will only be used for a
	// single logical operation (e.g., as a git remote helper).
	InitSingleOpString = "singleOp"
	// InitConstrainedString is for when KBFS will use constrained
	// resources.
	InitConstrainedString = "constrained"
	// InitMemoryLimitedString is for when KBFS will use memory limited
	// resources.
	InitMemoryLimitedString = "memoryLimited"
)

// AdditionalProtocolCreator creates an additional protocol.
type AdditionalProtocolCreator func(Context, Config) (rpc.Protocol, error)

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
	MetadataVersion kbfsmd.MetadataVer

	// BlockCryptVersion is the encryption version to use when
	// encrypting new blocks.
	BlockCryptVersion kbfscrypto.EncryptionVer

	// LogToFile if true, logs to a default file location.
	LogToFile bool

	// LogFileConfig tells us where to log and rotation config.
	LogFileConfig logger.LogFileConfig

	// TLFJournalBackgroundWorkStatus is the status to use to
	// pass into JournalServer.enableJournaling. Only has an effect when
	// EnableJournal is non-empty.
	TLFJournalBackgroundWorkStatus TLFJournalBackgroundWorkStatus

	// AdditionalProtocolCreators are for adding additional protocols that we
	// should handle for service to call in.
	AdditionalProtocolCreators []AdditionalProtocolCreator

	// EnableJournal enables journaling.
	EnableJournal bool

	// DiskCacheMode specifies which mode to start the disk cache.
	DiskCacheMode DiskCacheMode

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

	// DiskBlockCacheFraction indicates what fraction of free space on the disk
	// is allowed to be occupied by the KBFS disk block cache.
	DiskBlockCacheFraction float64

	// SyncBlockCacheFraction indicates what fraction of free space on the disk
	// is allowed to be occupied by the KBFS sync block cache for offline use.
	SyncBlockCacheFraction float64
}

// defaultBServer returns the default value for the -bserver flag.
func defaultBServer(ctx Context) string {
	switch ctx.GetRunMode() {
	case kbconst.DevelRunMode:
		return memoryAddr
	case kbconst.StagingRunMode:
		return `
			bserver-0.dev.keybase.io:443,bserver-1.dev.keybase.io:443`
	case kbconst.ProductionRunMode:
		return `
			bserver-0.kbfs.keybaseapi.com:443,bserver-1.kbfs.keybaseapi.com:443;
			bserver-0.kbfs.keybase.io:443,bserver-1.kbfs.keybase.io:443`
	default:
		return ""
	}
}

// defaultMDServer returns the default value for the -mdserver flag.
func defaultMDServer(ctx Context) string {
	switch ctx.GetRunMode() {
	case kbconst.DevelRunMode:
		return memoryAddr
	case kbconst.StagingRunMode:
		return `
			mdserver-0.dev.keybase.io:443,mdserver-1.dev.keybase.io:443`
	case kbconst.ProductionRunMode:
		return `
			mdserver-0.kbfs.keybaseapi.com:443,mdserver-1.kbfs.keybaseapi.com:443;
			mdserver-0.kbfs.keybase.io:443,mdserver-1.kbfs.keybase.io:443`
	default:
		return ""
	}
}

// defaultMetadataVersion returns the default metadata version per run mode.
func defaultMetadataVersion(ctx Context) kbfsmd.MetadataVer {
	switch ctx.GetRunMode() {
	case kbconst.DevelRunMode:
		return kbfsmd.ImplicitTeamsVer
	case kbconst.StagingRunMode:
		return kbfsmd.ImplicitTeamsVer
	case kbconst.ProductionRunMode:
		return kbfsmd.ImplicitTeamsVer
	default:
		return kbfsmd.ImplicitTeamsVer
	}
}

func defaultLogPath(ctx Context) string {
	return filepath.Join(ctx.GetLogDir(), libkb.KBFSLogFileName)
}

// DefaultInitParams returns default init params
func DefaultInitParams(ctx Context) InitParams {
	journalEnv := os.Getenv("KBFS_DEFAULT_ENABLE_JOURNAL_VALUE")
	if journalEnv == "" {
		journalEnv = "true"
	}
	return InitParams{
		Debug:             BoolForString(os.Getenv("KBFS_DEBUG")),
		BServerAddr:       defaultBServer(ctx),
		MDServerAddr:      defaultMDServer(ctx),
		TLFValidDuration:  tlfValidDurationDefault,
		MetadataVersion:   defaultMetadataVersion(ctx),
		BlockCryptVersion: kbfscrypto.EncryptionSecretbox,
		LogFileConfig: logger.LogFileConfig{
			MaxAge:       30 * 24 * time.Hour,
			MaxSize:      128 * 1024 * 1024,
			MaxKeepFiles: 3,
		},
		TLFJournalBackgroundWorkStatus: TLFJournalBackgroundWorkEnabled,
		StorageRoot:                    ctx.GetDataDir(),
		BGFlushPeriod:                  bgFlushPeriodDefault,
		BGFlushDirOpBatchSize:          bgFlushDirOpBatchSizeDefault,
		EnableJournal:                  BoolForString(journalEnv),
		DiskCacheMode:                  DiskCacheModeLocal,
		DiskBlockCacheFraction:         0.10,
		SyncBlockCacheFraction:         1.00,
		Mode: InitDefaultString,
	}
}

// AddFlagsWithDefaults adds libkbfs flags to the given FlagSet, given
// a set of default flags. Returns an InitParams that will be filled
// in once the given FlagSet is parsed.
func AddFlagsWithDefaults(
	flags *flag.FlagSet, defaultParams InitParams,
	defaultLogPath string) *InitParams {
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
	flags.BoolVar(&params.LogToFile, "log-to-file", defaultParams.LogToFile,
		fmt.Sprintf("Log to default file: %s", defaultLogPath))
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
	params.DiskCacheMode = defaultParams.DiskCacheMode
	flags.Var(&params.DiskCacheMode, "disk-cache-mode",
		"Sets the mode for the disk cache. If 'local', then it uses a "+
			"subdirectory of -storage-root to store the cache. If 'remote', "+
			"then it connects to the local KBFS instance and delegates disk "+
			"cache operations to it.")
	flags.BoolVar(&params.EnableJournal, "enable-journal",
		defaultParams.EnableJournal, "Enables write journaling for TLFs.")

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
			"trigger an immediate data sync.")

	flags.IntVar((*int)(&params.MetadataVersion), "md-version",
		int(defaultParams.MetadataVersion),
		"Metadata version to use when creating new metadata")
	flags.IntVar((*int)(&params.BlockCryptVersion), "block-crypt-version",
		int(defaultParams.BlockCryptVersion),
		"Encryption version to use when encrypting new blocks")
	flags.StringVar(&params.Mode, "mode", defaultParams.Mode,
		fmt.Sprintf("Overall initialization mode for KBFS, indicating how "+
			"heavy-weight it can be (%s, %s, %s, %s or %s)", InitDefaultString,
			InitMinimalString, InitSingleOpString, InitConstrainedString,
			InitMemoryLimitedString))

	flags.Float64Var((*float64)(&params.DiskBlockCacheFraction),
		"disk-block-cache-fraction", defaultParams.DiskBlockCacheFraction,
		"The portion of the free disk space that KBFS will use for caching ")

	flags.Float64Var((*float64)(&params.SyncBlockCacheFraction),
		"sync-block-cache-fraction", defaultParams.SyncBlockCacheFraction,
		"The portion of the free disk space that KBFS will use for offline storage")

	return &params
}

// AddFlags adds libkbfs flags to the given FlagSet. Returns an
// InitParams that will be filled in once the given FlagSet is parsed.
func AddFlags(flags *flag.FlagSet, ctx Context) *InitParams {
	return AddFlagsWithDefaults(
		flags, DefaultInitParams(ctx), defaultLogPath(ctx))
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
	rpcLogFactory rpc.LogFactory, log logger.Logger) (
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

	remote, err := rpc.ParsePrioritizedRoundRobinRemote(mdserverAddr)
	if err != nil {
		return nil, err
	}
	// remote MD server. this can't fail. reconnection attempts
	// will be automatic.
	log.Debug("Using remote mdserver %s", remote)
	mdServer := NewMDServerRemote(config, remote, rpcLogFactory)
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
	rpcLogFactory rpc.LogFactory,
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

	remote, err := rpc.ParsePrioritizedRoundRobinRemote(bserverAddr)
	if err != nil {
		return nil, err
	}
	log.Debug("Using remote bserver %s", remote)
	return NewBlockServerRemote(config, remote, rpcLogFactory), nil
}

// InitLogWithPrefix sets up logging switching to a log file if
// necessary, given a prefix and a default log path.  Returns a valid
// logger even on error, which are non-fatal, thus errors from this
// function may be ignored.  Possible errors are logged to the logger
// returned.
func InitLogWithPrefix(
	params InitParams, ctx Context, prefix string,
	defaultLogPath string) (logger.Logger, error) {
	var err error

	// Set log file to default if log-to-file was specified
	if params.LogToFile {
		if params.LogFileConfig.Path != "" {
			return nil, fmt.Errorf(
				"log-to-file and log-file flags can't be specified together")
		}
		params.LogFileConfig.Path = defaultLogPath
	}

	if params.LogFileConfig.Path != "" {
		err = logger.SetLogFileConfig(&params.LogFileConfig)
	}
	log := logger.New(prefix)

	log.Configure("", params.Debug, "")
	log.Info("KBFS version %s", VersionString())

	if err != nil {
		log.Warning("Failed to setup log file %q: %+v",
			params.LogFileConfig.Path, err)
	}

	return log, err
}

// InitLog sets up logging switching to a log file if necessary.
// Returns a valid logger even on error, which are non-fatal, thus
// errors from this function may be ignored.
// Possible errors are logged to the logger returned.
func InitLog(params InitParams, ctx Context) (logger.Logger, error) {
	return InitLogWithPrefix(params, ctx, "kbfs", defaultLogPath(ctx))
}

// InitWithLogPrefix initializes a config and returns it, given a prefix.
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
func InitWithLogPrefix(
	ctx context.Context, kbCtx Context, params InitParams,
	keybaseServiceCn KeybaseServiceCn, onInterruptFn func(),
	log logger.Logger, logPrefix string) (cfg Config, err error) {
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
		cfg, er = doInit(ctx, kbCtx, params, keybaseServiceCn, log, logPrefix)
		errCh <- er
	}()

	select {
	case <-done:
		return nil, errors.New(os.Interrupt.String())
	case err = <-errCh:
		return cfg, err
	}
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
func Init(
	ctx context.Context, kbCtx Context, params InitParams,
	keybaseServiceCn KeybaseServiceCn, onInterruptFn func(),
	log logger.Logger) (cfg Config, err error) {
	return InitWithLogPrefix(
		ctx, kbCtx, params, keybaseServiceCn, onInterruptFn, log, "kbfs")
}

func doInit(
	ctx context.Context, kbCtx Context, params InitParams,
	keybaseServiceCn KeybaseServiceCn, log logger.Logger,
	logPrefix string) (Config, error) {
	mode := InitDefault
	switch params.Mode {
	case InitDefaultString:
		log.CDebugf(ctx, "Initializing in default mode")
		// Already the default
	case InitMinimalString:
		log.CDebugf(ctx, "Initializing in minimal mode")
		mode = InitMinimal
	case InitSingleOpString:
		log.CDebugf(ctx, "Initializing in singleOp mode")
		mode = InitSingleOp
	case InitConstrainedString:
		log.CDebugf(ctx, "Initializing in constrained mode")
		mode = InitConstrained
	case InitMemoryLimitedString:
		log.CDebugf(ctx, "Initializing in memoryLimited mode")
		mode = InitMemoryLimited
	default:
		return nil, fmt.Errorf("Unexpected mode: %s", params.Mode)
	}

	initMode := NewInitModeFromType(mode)

	config := NewConfigLocal(initMode,
		func(module string) logger.Logger {
			mname := logPrefix
			if module != "" {
				mname += fmt.Sprintf("(%s)", module)
			}
			lg := logger.New(mname)
			if params.Debug {
				// Turn on debugging.  TODO: allow a proper log file and
				// style to be specified.
				lg.Configure("", true, "")
			}
			return lg
		}, params.StorageRoot, params.DiskCacheMode, kbCtx)

	if params.CleanBlockCacheCapacity > 0 {
		log.CDebugf(
			ctx, "overriding default clean block cache capacity from %d to %d",
			config.BlockCache().GetCleanBytesCapacity(),
			params.CleanBlockCacheCapacity)
		config.BlockCache().SetCleanBytesCapacity(
			params.CleanBlockCacheCapacity)
	}

	workers := config.Mode().BlockWorkers()
	prefetchWorkers := config.Mode().PrefetchWorkers()
	config.SetBlockOps(NewBlockOpsStandard(config, workers, prefetchWorkers))

	bsplitter, err := NewBlockSplitterSimple(MaxBlockSizeBytesDefault, 8*1024,
		config.Codec())
	if err != nil {
		return nil, err
	}
	err = bsplitter.SetMaxDirEntriesByBlockSize(config.Codec())
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

	config.SetMetadataVersion(kbfsmd.MetadataVer(params.MetadataVersion))
	config.SetBlockCryptVersion(
		kbfscrypto.EncryptionVer(params.BlockCryptVersion))
	config.SetTLFValidDuration(params.TLFValidDuration)
	config.SetBGFlushPeriod(params.BGFlushPeriod)

	kbfsLog := config.MakeLogger("")

	// Initialize Keybase service connection
	if keybaseServiceCn == nil {
		keybaseServiceCn = keybaseDaemon{}
	}
	service, err := keybaseServiceCn.NewKeybaseService(
		config, params, kbCtx, kbfsLog)
	if err != nil {
		return nil, fmt.Errorf("problem creating service: %s", err)
	}

	// Initialize Chat client (for file edit notifications).
	chat, err := keybaseServiceCn.NewChat(config, params, kbCtx, kbfsLog)
	if err != nil {
		return nil, fmt.Errorf("problem creating chat: %s", err)
	}
	config.SetChat(chat)

	// Initialize KBPKI client (needed for KBFSOps and MD Server).
	k := NewKBPKIClient(config, kbfsLog)
	config.SetKBPKI(k)

	kbfsOps := NewKBFSOpsStandard(kbCtx, config)
	config.SetKBFSOps(kbfsOps)
	config.SetNotifier(kbfsOps)
	config.SetKeyManager(NewKeyManagerStandard(config))
	config.SetMDOps(NewMDOpsStandard(config))

	if registry := config.MetricsRegistry(); registry != nil {
		service = NewKeybaseServiceMeasured(service, registry)
	}
	config.SetKeybaseService(service)

	kbfsOps.favs.Initialize(ctx)

	config.SetReporter(NewReporterKBPKI(config, 10, 1000))

	// Initialize Crypto client (needed for MD and Block servers).
	crypto, err := keybaseServiceCn.NewCrypto(config, params, kbCtx, kbfsLog)
	if err != nil {
		return nil, fmt.Errorf("problem creating crypto: %s", err)
	}
	config.SetCrypto(crypto)

	// Initialize MDServer connection.
	mdServer, err := makeMDServer(
		config, params.MDServerAddr, kbCtx.NewRPCLogFactory(), log)
	if err != nil {
		return nil, fmt.Errorf("problem creating MD server: %+v", err)
	}
	config.SetMDServer(mdServer)

	// Must do this after setting the md server, since it depends on
	// being able to fetch MDs.
	go kbfsOps.initSyncedTlfs()

	// Initialize KeyServer connection.  MDServer is the KeyServer at the
	// moment.
	keyServer, err := makeKeyServer(config, params.MDServerAddr, log)
	if err != nil {
		return nil, fmt.Errorf("problem creating key server: %+v", err)
	}
	if registry := config.MetricsRegistry(); registry != nil {
		keyServer = NewKeyServerMeasured(keyServer, registry)
	}
	config.SetKeyServer(keyServer)

	// Initialize BlockServer connection.
	bserv, err := makeBlockServer(
		config, params.BServerAddr, kbCtx.NewRPCLogFactory(), log)
	if err != nil {
		return nil, fmt.Errorf("cannot open block database: %+v", err)
	}
	if registry := config.MetricsRegistry(); registry != nil {
		bserv = NewBlockServerMeasured(bserv, registry)
	}
	config.SetBlockServer(bserv)

	config.SetDiskBlockCacheFraction(params.DiskBlockCacheFraction)
	config.SetSyncBlockCacheFraction(params.SyncBlockCacheFraction)

	err = config.MakeDiskBlockCacheIfNotExists()
	if err != nil {
		log.CWarningf(ctx, "Could not initialize disk cache: %+v", err)
		notification := &keybase1.FSNotification{
			StatusCode:       keybase1.FSStatusCode_ERROR,
			NotificationType: keybase1.FSNotificationType_INITIALIZED,
			ErrorType:        keybase1.FSErrorType_DISK_CACHE_ERROR_LOG_SEND,
		}
		defer config.Reporter().Notify(ctx, notification)
	} else {
		log.CDebugf(ctx, "Disk cache of type \"%s\" enabled",
			params.DiskCacheMode.String())
	}

	err = config.MakeDiskMDCacheIfNotExists()
	if err != nil {
		log.CWarningf(ctx, "Could not initialize MD cache: %+v", err)
		notification := &keybase1.FSNotification{
			StatusCode:       keybase1.FSStatusCode_ERROR,
			NotificationType: keybase1.FSNotificationType_INITIALIZED,
			ErrorType:        keybase1.FSErrorType_DISK_CACHE_ERROR_LOG_SEND,
		}
		defer config.Reporter().Notify(ctx, notification)
	} else {
		log.CDebugf(ctx, "Disk MD cache enabled")
	}

	err = config.MakeDiskQuotaCacheIfNotExists()
	if err != nil {
		log.CWarningf(ctx, "Could not initialize disk quota cache: %+v", err)
		notification := &keybase1.FSNotification{
			StatusCode:       keybase1.FSStatusCode_ERROR,
			NotificationType: keybase1.FSNotificationType_INITIALIZED,
			ErrorType:        keybase1.FSErrorType_DISK_CACHE_ERROR_LOG_SEND,
		}
		defer config.Reporter().Notify(ctx, notification)
	} else {
		log.CDebugf(ctx, "Disk quota cache enabled")
	}

	err = config.MakeBlockMetadataStoreIfNotExists()
	if err != nil {
		log.CWarningf(ctx,
			"Could not initialize block metadata store: %+v", err)
		return nil, err
		// TODO (KBFS-3659): when we can open levelDB read-only, re-enable
		//                   this, instead of failing the init.
		/*
			notification := &keybase1.FSNotification{
				StatusCode:       keybase1.FSStatusCode_ERROR,
				NotificationType: keybase1.FSNotificationType_INITIALIZED,
				ErrorType:        keybase1.FSErrorType_DISK_CACHE_ERROR_LOG_SEND,
			}
			defer config.Reporter().Notify(ctx, notification)
		*/
	}
	log.CDebugf(ctx, "Disk block metadata store cache enabled")

	if config.Mode().KBFSServiceEnabled() {
		// Initialize kbfsService only when we run a full KBFS process.
		// This requires the disk block cache to have been initialized, if it
		// should be initialized.
		kbfsService, err := NewKBFSService(kbCtx, config)
		if err != nil {
			// This error shouldn't be fatal
			log.CWarningf(ctx, "Error starting RPC server for KBFS: %+v", err)
		} else {
			config.SetKBFSService(kbfsService)
			log.CDebugf(ctx, "Started RPC server for KBFS")
		}
	}

	err = config.EnableDiskLimiter(params.StorageRoot)
	if err != nil {
		log.CWarningf(ctx, "Could not enable disk limiter: %+v", err)
		return nil, err
	}
	ctx10s, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	// TODO: Don't turn on journaling if either -bserver or
	// -mdserver point to local implementations.
	if params.EnableJournal && config.Mode().JournalEnabled() {
		journalRoot := filepath.Join(params.StorageRoot, "kbfs_journal")
		err = config.EnableJournaling(ctx10s, journalRoot,
			params.TLFJournalBackgroundWorkStatus)
		if err != nil {
			log.CWarningf(ctx, "Could not initialize journal server: %+v", err)
		}
		log.CDebugf(ctx, "Journaling enabled")
	}

	if params.BGFlushDirOpBatchSize < 1 {
		return nil, fmt.Errorf(
			"Illegal sync batch size: %d", params.BGFlushDirOpBatchSize)
	}
	log.CDebugf(ctx, "Enabling a dir op batch size of %d",
		params.BGFlushDirOpBatchSize)
	config.SetBGFlushDirOpBatchSize(params.BGFlushDirOpBatchSize)

	return config, nil
}

// Shutdown does any necessary shutdown tasks for libkbfs. Shutdown
// should be called at the end of main.
func Shutdown() {}
