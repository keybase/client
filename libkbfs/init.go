package libkbfs

import (
	"flag"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"runtime/pprof"
	"sync"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
)

// InitParams contains the initialization parameters for Init(). It is
// usually filled in by the flags parser passed into AddFlags().
type InitParams struct {
	// Whether to print debug messages.
	Debug bool
	// If non-empty, where to write a CPU profile.
	CPUProfile string
	// If non-empty, where to write a memory profile.
	MemProfile string

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
	// Fake local user name. Only used if ServerInMemory is set or
	// if ServerRootDir is non-empty.
	LocalUser string
}

var libkbOnce sync.Once

func initLibkb() {
	libkbOnce.Do(func() {
		libkb.G.Init()
		libkb.G.ConfigureConfig()
		libkb.G.ConfigureLogging()
		libkb.G.ConfigureCaches()
		libkb.G.ConfigureMerkleClient()
	})
}

func getRunMode() libkb.RunMode {
	// Initialize libkb.G.Env.
	initLibkb()
	return libkb.G.Env.GetRunMode()
}

// GetDefaultBServer returns the default value for the -bserver flag.
func GetDefaultBServer() string {
	switch getRunMode() {
	case libkb.StagingRunMode:
		return "bserver.dev.keybase.io:443"
	case libkb.ProductionRunMode:
		return "bserver.kbfs.keybase.io:443"
	default:
		return ""
	}
}

// GetDefaultMDServer returns the default value for the -mdserver flag.
func GetDefaultMDServer() string {
	switch getRunMode() {
	case libkb.StagingRunMode:
		return "mdserver.dev.keybase.io:443"
	case libkb.ProductionRunMode:
		return "mdserver.kbfs.keybase.io:443"
	default:
		return ""
	}
}

// AddFlags adds libkbfs flags to the given FlagSet. Returns an
// InitParams that will be filled in once the given FlagSet is parsed.
func AddFlags(flags *flag.FlagSet) *InitParams {
	var params InitParams
	flags.BoolVar(&params.Debug, "debug", false, "Print debug messages")
	flags.StringVar(&params.CPUProfile, "cpuprofile", "", "write cpu profile to file")
	flags.StringVar(&params.MemProfile, "memprofile", "", "write memory profile to file")

	flags.StringVar(&params.BServerAddr, "bserver", GetDefaultBServer(), "host:port of the block server")
	flags.StringVar(&params.MDServerAddr, "mdserver", GetDefaultMDServer(), "host:port of the metadata server")

	flags.BoolVar(&params.ServerInMemory, "server-in-memory", false, "use in-memory server (and ignore -bserver, -mdserver, and -server-root)")
	flags.StringVar(&params.ServerRootDir, "server-root", "", "directory to put local server files (and ignore -bserver and -mdserver)")
	flags.StringVar(&params.LocalUser, "localuser", "", "fake local user (used only with -server-in-memory or -server-root)")
	return &params
}

func makeMDServer(config Config, serverRootDir *string, mdserverAddr string) (
	MDServer, error) {
	if serverRootDir == nil {
		// local in-memory MD server
		return NewMDServerMemory(config)
	}

	if len(mdserverAddr) == 0 {
		// local persistent MD server
		handlePath := filepath.Join(*serverRootDir, "kbfs_handles")
		mdPath := filepath.Join(*serverRootDir, "kbfs_md")
		branchPath := filepath.Join(*serverRootDir, "kbfs_branches")
		return NewMDServerLocal(
			config, handlePath, mdPath, branchPath)
	}

	// remote MD server. this can't fail. reconnection attempts
	// will be automatic.
	mdServer := NewMDServerRemote(config, mdserverAddr)
	return mdServer, nil
}

func makeKeyServer(config Config, serverRootDir *string, keyserverAddr string) (
	KeyServer, error) {
	if serverRootDir == nil {
		// local in-memory key server
		return NewKeyServerMemory(config)
	}

	if len(keyserverAddr) == 0 {
		// local persistent key server
		keyPath := filepath.Join(*serverRootDir, "kbfs_key")
		return NewKeyServerLocal(config, keyPath)
	}

	// currently the remote MD server also acts as the key server.
	keyServer := config.MDServer().(*MDServerRemote)
	return keyServer, nil
}

func makeBlockServer(config Config, serverRootDir *string, bserverAddr string, log logger.Logger) (
	BlockServer, error) {
	if len(bserverAddr) == 0 {
		if serverRootDir == nil {
			return NewBlockServerMemory(config)
		}

		blockPath := filepath.Join(*serverRootDir, "kbfs_block")
		return NewBlockServerLocal(config, blockPath)
	}

	log.Debug("Using remote bserver %s", bserverAddr)
	return NewBlockServerRemote(config, bserverAddr), nil
}

func makeKeybaseDaemon(config Config, serverRootDir *string, localUser libkb.NormalizedUsername, codec Codec, log logger.Logger) (KeybaseDaemon, error) {
	if localUser == "" {
		libkb.G.ConfigureSocketInfo()
		return NewKeybaseDaemonRPC(config, libkb.G, log), nil
	}

	users := []libkb.NormalizedUsername{"strib", "max", "chris", "fred"}
	userIndex := -1
	for i := range users {
		if localUser == users[i] {
			userIndex = i
			break
		}
	}
	if userIndex < 0 {
		return nil, fmt.Errorf("user %s not in list %v", localUser, users)
	}

	localUsers := MakeLocalUsers(users)

	// TODO: Auto-generate these, too?
	localUsers[0].Asserts = []string{"github:strib"}
	localUsers[1].Asserts = []string{"twitter:maxtaco"}
	localUsers[2].Asserts = []string{"twitter:malgorithms"}
	localUsers[3].Asserts = []string{"twitter:fakalin"}

	var localUID keybase1.UID
	if userIndex >= 0 {
		localUID = localUsers[userIndex].UID
	}

	if serverRootDir == nil {
		return NewKeybaseDaemonMemory(localUID, localUsers), nil
	}

	favPath := filepath.Join(*serverRootDir, "kbfs_favs")
	return NewKeybaseDaemonDisk(localUID, localUsers, favPath, codec)
}

// Init initializes a config and returns it.
//
// onInterruptFn is called whenever an interrupt signal is received
// (e.g., if the user hits Ctrl-C).
//
// Init should be called at the beginning of main. Shutdown (see
// below) should then be called at the end of main (usually via
// defer).
func Init(params InitParams, onInterruptFn func(), log logger.Logger) (Config, error) {
	initLibkb()

	localUser := libkb.NewNormalizedUsername(params.LocalUser)

	var serverRootDir *string
	if !params.ServerInMemory {
		serverRootDir = &params.ServerRootDir
	}

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

		Shutdown(params.MemProfile)

		if onInterruptFn != nil {
			onInterruptFn()
		}

		os.Exit(1)
	}()

	config := NewConfigLocal()

	// 64K blocks by default, block changes embedded max == 8K
	bsplitter, err := NewBlockSplitterSimple(64*1024, 8*1024,
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
		lg := logger.NewWithCallDepth(mname, 1, os.Stderr)
		if params.Debug {
			// Turn on debugging.  TODO: allow a proper log file and
			// style to be specified.
			lg.Configure("", true, "")
		}
		return lg
	})

	config.SetKeyManager(NewKeyManagerStandard(config))

	mdServer, err := makeMDServer(config, serverRootDir, params.MDServerAddr)
	if err != nil {
		return nil, fmt.Errorf("problem creating MD server: %v", err)
	}
	config.SetMDServer(mdServer)

	// note: the mdserver is the keyserver at the moment.
	keyServer, err := makeKeyServer(config, serverRootDir, params.MDServerAddr)
	if err != nil {
		return nil, fmt.Errorf("problem creating key server: %v", err)
	}

	if registry := config.MetricsRegistry(); registry != nil {
		keyServer = NewKeyServerMeasured(keyServer, registry)
	}

	config.SetKeyServer(keyServer)

	client.InitUI()
	if err := client.GlobUI.Configure(); err != nil {
		log.Warning("problem configuring UI: %s", err)
		log.Warning("ignoring for now...")
	}

	daemon, err := makeKeybaseDaemon(config, serverRootDir, localUser, config.Codec(), config.MakeLogger(""))
	if err != nil {
		return nil, fmt.Errorf("problem creating daemon: %s", err)
	}

	if registry := config.MetricsRegistry(); registry != nil {
		daemon = NewKeybaseDaemonMeasured(daemon, registry)
	}

	config.SetKeybaseDaemon(daemon)

	k := NewKBPKIClient(config)
	config.SetKBPKI(k)

	config.SetReporter(NewReporterKBPKI(config, 10, 1000))

	if localUser == "" {
		c := NewCryptoClient(config, libkb.G, config.MakeLogger(""))
		config.SetCrypto(c)
	} else {
		signingKey := MakeLocalUserSigningKeyOrBust(localUser)
		cryptPrivateKey := MakeLocalUserCryptPrivateKeyOrBust(localUser)
		config.SetCrypto(NewCryptoLocal(config, signingKey, cryptPrivateKey))
	}

	bserv, err := makeBlockServer(config, serverRootDir, params.BServerAddr, log)
	if err != nil {
		return nil, fmt.Errorf("cannot open block database: %v", err)
	}

	if registry := config.MetricsRegistry(); registry != nil {
		bserv = NewBlockServerMeasured(bserv, registry)
	}

	config.SetBlockServer(bserv)

	return config, nil
}

// Shutdown does any necessary shutdown tasks for libkbfs. Shutdown
// should be called at the end of main.
func Shutdown(memProfilePath string) error {
	pprof.StopCPUProfile()

	if memProfilePath != "" {
		// Let the GC/OS clean up the file handle.
		f, err := os.Create(memProfilePath)
		if err != nil {
			return err
		}

		pprof.WriteHeapProfile(f)
	}

	return nil
}
