// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"runtime/pprof"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
)

// InitParams contains the initialization parameters for Init(). It is
// usually filled in by the flags parser passed into AddFlags().
type InitParams struct {
	// Whether to print debug messages.
	Debug bool
	// If non-empty, where to write a CPU profile.
	CPUProfile string

	// If non-empty, the host:port of the block server. If empty,
	// a default value is used depending on the run mode.
	BServerAddr string
	// If non-empty the host:port of the metadata server. If
	// empty, a default value is used depending on the run mode.
	MDServerAddr string

	// If true, use in-memory servers and ignore BServerAddr,
	// MDServerAddr, and ServerRootDir.
	ServerInMemory bool
	// If non-empty, use on-disk servers and ignore BServerAddr
	// and MDServerAddr.
	ServerRootDir string
	// Fake local user name. If non-empty, either ServerInMemory
	// must be true or ServerRootDir must be non-empty.
	LocalUser string

	// TLFValidDuration is the duration that TLFs are valid
	// before marked for lazy revalidation.
	TLFValidDuration time.Duration

	// LogToFile if true, logs to a default file location.
	LogToFile bool

	// LogFileConfig tells us where to log and rotation config.
	LogFileConfig logger.LogFileConfig

	// WriteJournalRoot, if non-empty, points to a path to a local
	// directory to put write journals in. If non-empty, enables
	// write journaling to be turned on for TLFs.
	WriteJournalRoot string
}

// GetDefaultBServer returns the default value for the -bserver flag.
func GetDefaultBServer(ctx Context) string {
	switch ctx.GetRunMode() {
	case libkb.StagingRunMode:
		return "bserver.dev.keybase.io:443"
	case libkb.ProductionRunMode:
		return "bserver.kbfs.keybase.io:443"
	default:
		return ""
	}
}

// GetDefaultMDServer returns the default value for the -mdserver flag.
func GetDefaultMDServer(ctx Context) string {
	switch ctx.GetRunMode() {
	case libkb.StagingRunMode:
		return "mdserver.dev.keybase.io:443"
	case libkb.ProductionRunMode:
		return "mdserver.kbfs.keybase.io:443"
	default:
		return ""
	}
}

func defaultLogPath(ctx Context) string {
	return filepath.Join(ctx.GetLogDir(), libkb.KBFSLogFileName)
}

// DefaultInitParams returns default init params
func DefaultInitParams(ctx Context) InitParams {
	return InitParams{
		Debug:            BoolForString(os.Getenv("KBFS_DEBUG")),
		BServerAddr:      GetDefaultBServer(ctx),
		MDServerAddr:     GetDefaultMDServer(ctx),
		TLFValidDuration: tlfValidDurationDefault,
		LogFileConfig: logger.LogFileConfig{
			MaxAge:       30 * 24 * time.Hour,
			MaxSize:      128 * 1024 * 1024,
			MaxKeepFiles: 3,
		},
	}
}

// AddFlags adds libkbfs flags to the given FlagSet. Returns an
// InitParams that will be filled in once the given FlagSet is parsed.
func AddFlags(flags *flag.FlagSet, ctx Context) *InitParams {
	defaultParams := DefaultInitParams(ctx)

	var params InitParams
	flags.BoolVar(&params.Debug, "debug", defaultParams.Debug, "Print debug messages")
	flags.StringVar(&params.CPUProfile, "cpuprofile", "", "write cpu profile to file")

	flags.StringVar(&params.BServerAddr, "bserver", defaultParams.BServerAddr, "host:port of the block server")
	flags.StringVar(&params.MDServerAddr, "mdserver", defaultParams.MDServerAddr, "host:port of the metadata server")

	flags.BoolVar(&params.ServerInMemory, "server-in-memory", false, "use in-memory server (and ignore -bserver, -mdserver, and -server-root)")
	flags.StringVar(&params.ServerRootDir, "server-root", "", "directory to put local server files (and ignore -bserver and -mdserver)")
	flags.StringVar(&params.LocalUser, "localuser", "", "fake local user (used only with -server-in-memory or -server-root)")
	flags.DurationVar(&params.TLFValidDuration, "tlf-valid", defaultParams.TLFValidDuration, "time tlfs are valid before redoing identification")
	flags.BoolVar(&params.LogToFile, "log-to-file", false, fmt.Sprintf("Log to default file: %s", defaultLogPath(ctx)))
	flags.StringVar(&params.LogFileConfig.Path, "log-file", "", "Path to log file")
	flags.DurationVar(&params.LogFileConfig.MaxAge, "log-file-max-age", defaultParams.LogFileConfig.MaxAge, "Maximum age of a log file before rotation")
	params.LogFileConfig.MaxSize = defaultParams.LogFileConfig.MaxSize
	flag.Var(SizeFlag{&params.LogFileConfig.MaxSize}, "log-file-max-size", "Maximum size of a log file before rotation")
	// The default is to *DELETE* old log files for kbfs.
	flag.IntVar(&params.LogFileConfig.MaxKeepFiles, "log-file-max-keep-files", defaultParams.LogFileConfig.MaxKeepFiles, "Maximum number of log files for this service, older ones are deleted. 0 for infinite.")
	flags.StringVar(&params.WriteJournalRoot, "write-journal-root-this-may-lose-data", "", "(EXPERIMENTAL) If non-empty, permits write journals to be turned on for TLFs which will be put in the given directory")
	return &params
}

func makeMDServer(config Config, serverInMemory bool, serverRootDir, mdserverAddr string, ctx Context) (
	MDServer, error) {
	if serverInMemory {
		// local in-memory MD server
		return NewMDServerMemory(config)
	}

	if len(serverRootDir) > 0 {
		// local persistent MD server
		mdPath := filepath.Join(serverRootDir, "kbfs_md")
		return NewMDServerDir(config, mdPath)
	}

	if len(mdserverAddr) == 0 {
		return nil, errors.New("Empty MD server address")
	}

	// remote MD server. this can't fail. reconnection attempts
	// will be automatic.
	mdServer := NewMDServerRemote(config, mdserverAddr, ctx)
	return mdServer, nil
}

func makeKeyServer(config Config, serverInMemory bool, serverRootDir, keyserverAddr string) (
	KeyServer, error) {
	if serverInMemory {
		// local in-memory key server
		return NewKeyServerMemory(config)
	}

	if len(serverRootDir) > 0 {
		// local persistent key server
		keyPath := filepath.Join(serverRootDir, "kbfs_key")
		return NewKeyServerDir(config, keyPath)
	}

	if len(keyserverAddr) == 0 {
		return nil, errors.New("Empty key server address")
	}

	// currently the MD server also acts as the key server.
	keyServer, ok := config.MDServer().(KeyServer)
	if !ok {
		return nil, errors.New("MD server is not a key server")
	}
	return keyServer, nil
}

func makeBlockServer(config Config, serverInMemory bool, serverRootDir, bserverAddr string, ctx Context, log logger.Logger) (
	BlockServer, error) {
	if serverInMemory {
		// local in-memory block server
		return NewBlockServerMemory(config), nil
	}

	if len(serverRootDir) > 0 {
		// local persistent block server
		blockPath := filepath.Join(serverRootDir, "kbfs_block")
		return NewBlockServerDir(config, blockPath), nil
	}

	if len(bserverAddr) == 0 {
		return nil, errors.New("Empty block server address")
	}

	log.Debug("Using remote bserver %s", bserverAddr)
	return NewBlockServerRemote(config, bserverAddr, ctx), nil
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
			return nil, fmt.Errorf("log-to-file and log-file flags can't be specified together")
		}
		params.LogFileConfig.Path = defaultLogPath(ctx)
	}

	if params.LogFileConfig.Path != "" {
		err = logger.SetLogFileConfig(&params.LogFileConfig)
	}

	log.Configure("", params.Debug, "")
	log.Info("KBFS version %s", VersionString())

	if err != nil {
		log.Warning("Failed to setup log file %q: %v", params.LogFileConfig.Path, err)
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
// The keybaseDaemonFn argument is to temporarily support KBFS on
// mobile (for using a custom KeybaseService implementation) and will
// be removed in the future, when we use a non-RPC implementation.
func Init(ctx Context, params InitParams, keybaseServiceFn KeybaseServiceFn, onInterruptFn func(), log logger.Logger) (Config, error) {

	if params.CPUProfile != "" {
		// Let the GC/OS clean up the file handle.
		f, err := os.Create(params.CPUProfile)
		if err != nil {
			return nil, err
		}
		pprof.StartCPUProfile(f)
	}

	interruptChan := make(chan os.Signal, 1)
	signal.Notify(interruptChan, os.Interrupt)
	go func() {
		_ = <-interruptChan

		if onInterruptFn != nil {
			onInterruptFn()
		}

		os.Exit(1)
	}()

	config := NewConfigLocal()

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
	}

	// Set logging
	config.SetLoggerMaker(func(module string) logger.Logger {
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
	})

	config.SetTLFValidDuration(params.TLFValidDuration)

	kbfsOps := NewKBFSOpsStandard(config)
	config.SetKBFSOps(kbfsOps)
	config.SetNotifier(kbfsOps)
	config.SetKeyManager(NewKeyManagerStandard(config))
	config.SetMDOps(NewMDOpsStandard(config))

	mdServer, err := makeMDServer(
		config, params.ServerInMemory, params.ServerRootDir, params.MDServerAddr, ctx)
	if err != nil {
		return nil, fmt.Errorf("problem creating MD server: %v", err)
	}
	config.SetMDServer(mdServer)

	// note: the mdserver is the keyserver at the moment.
	keyServer, err := makeKeyServer(
		config, params.ServerInMemory, params.ServerRootDir, params.MDServerAddr)
	if err != nil {
		return nil, fmt.Errorf("problem creating key server: %v", err)
	}

	if registry := config.MetricsRegistry(); registry != nil {
		keyServer = NewKeyServerMeasured(keyServer, registry)
	}

	config.SetKeyServer(keyServer)

	if keybaseServiceFn == nil {
		keybaseServiceFn = makeKeybaseDaemon
	}
	service, err := keybaseServiceFn(config, params, ctx, config.MakeLogger(""))
	if err != nil {
		return nil, fmt.Errorf("problem creating daemon: %s", err)
	}

	if registry := config.MetricsRegistry(); registry != nil {
		service = NewKeybaseServiceMeasured(service, registry)
	}

	config.SetKeybaseService(service)

	k := NewKBPKIClient(config)
	config.SetKBPKI(k)

	config.SetReporter(NewReporterKBPKI(config, 10, 1000))

	var crypto Crypto
	localUser := libkb.NewNormalizedUsername(params.LocalUser)
	if localUser == "" {
		crypto = NewCryptoClient(config, ctx)
	} else {
		signingKey := MakeLocalUserSigningKeyOrBust(localUser)
		cryptPrivateKey := MakeLocalUserCryptPrivateKeyOrBust(localUser)
		crypto = NewCryptoLocal(config, signingKey, cryptPrivateKey)
	}

	if registry := config.MetricsRegistry(); registry != nil {
		crypto = NewCryptoMeasured(crypto, registry)
	}

	config.SetCrypto(crypto)

	bserv, err := makeBlockServer(config, params.ServerInMemory, params.ServerRootDir, params.BServerAddr, ctx, log)
	if err != nil {
		return nil, fmt.Errorf("cannot open block database: %v", err)
	}

	if registry := config.MetricsRegistry(); registry != nil {
		bserv = NewBlockServerMeasured(bserv, registry)
	}

	config.SetBlockServer(bserv)

	// TODO: Don't turn on journaling if -server-in-memory is
	// used.

	if len(params.WriteJournalRoot) > 0 {
		// TODO: Sanity-check the root directory, e.g. create
		// it if it doesn't exist, make sure that it doesn't
		// point to /keybase itself, etc.
		log := config.MakeLogger("")
		jServer := makeJournalServer(
			config, log, params.WriteJournalRoot,
			config.BlockServer(), config.MDOps())
		config.SetBlockServer(jServer.blockServer())
		config.SetMDOps(jServer.mdOps())
	}

	return config, nil
}

// Shutdown does any necessary shutdown tasks for libkbfs. Shutdown
// should be called at the end of main.
func Shutdown() {
	pprof.StopCPUProfile()
}
