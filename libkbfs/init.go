package libkbfs

import (
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"runtime/pprof"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/net/context"
)

func getMDServerAddr() string {
	// XXX TODO: the source of this will likely change soon
	return os.Getenv(EnvMDServerAddr)
}

func useLocalMDServer() bool {
	return len(getMDServerAddr()) == 0
}

func useLocalKeyServer() bool {
	// currently the remote MD server also acts as the key server.
	return useLocalMDServer()
}

func makeMDServer(config Config, serverRootDir *string) (
	MDServer, error) {
	if serverRootDir == nil {
		// local in-memory MD server
		return NewMDServerMemory(config)
	}

	if useLocalMDServer() {
		// local persistent MD server
		handlePath := filepath.Join(*serverRootDir, "kbfs_handles")
		mdPath := filepath.Join(*serverRootDir, "kbfs_md")
		revPath := filepath.Join(*serverRootDir, "kbfs_revisions")
		return NewMDServerLocal(
			config, handlePath, mdPath, revPath)
	}

	// remote MD server. this can't fail. reconnection attempts
	// will be automatic.
	mdServer := NewMDServerRemote(context.TODO(), config, getMDServerAddr())
	return mdServer, nil
}

func makeKeyServer(config Config, serverRootDir *string) (
	KeyServer, error) {
	if serverRootDir == nil {
		// local in-memory key server
		return NewKeyServerMemory(config)
	}

	if useLocalKeyServer() {
		// local persistent key server
		keyPath := filepath.Join(*serverRootDir, "kbfs_key")
		return NewKeyServerLocal(config, keyPath)
	}

	// currently the remote MD server also acts as the key server.
	keyServer := config.MDServer().(*MDServerRemote)
	return keyServer, nil
}

func makeBlockServer(config Config, serverRootDir *string) (BlockServer, error) {
	bServerAddr := os.Getenv(EnvBServerAddr)
	if len(bServerAddr) == 0 {
		if serverRootDir == nil {
			return NewBlockServerMemory(config)
		}

		blockPath := filepath.Join(*serverRootDir, "kbfs_block")
		return NewBlockServerLocal(config, blockPath)
	}

	fmt.Printf("Using remote bserver %s\n", bServerAddr)
	return NewBlockServerRemote(context.TODO(), config, bServerAddr), nil
}

func makeKBPKIClient(config Config, serverRootDir *string, localUser libkb.NormalizedUsername) (KBPKI, error) {
	if localUser == "" {
		libkb.G.ConfigureSocketInfo()
		return NewKBPKIClient(libkb.G, config.MakeLogger(""))
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
		return NewKBPKIMemory(localUID, localUsers), nil
	}

	favPath := filepath.Join(*serverRootDir, "kbfs_favs")
	return NewKBPKILocal(localUID, localUsers, favPath, config.Codec())
}

// Init initializes a config and returns it. If localUser is
// non-empty, libkbfs does not communicate to any remote servers and
// instead uses fake implementations of various servers.
//
// If serverRootDir is nil, an in-memory server is used. If it is
// non-nil and points to the empty string, the current working
// directory is used. Otherwise, the pointed-to string is treated as a
// path.
//
// onInterruptFn is called whenever an interrupt signal is received
// (e.g., if the user hits Ctrl-C).
//
// Init should be called at the beginning of main. Shutdown (see
// below) should then be called at the end of main (usually via
// defer).
func Init(localUser libkb.NormalizedUsername, serverRootDir *string, cpuProfilePath,
	memProfilePath string, onInterruptFn func(), debug bool) (Config, error) {
	if cpuProfilePath != "" {
		// Let the GC/OS clean up the file handle.
		f, err := os.Create(cpuProfilePath)
		if err != nil {
			return nil, err
		}
		pprof.StartCPUProfile(f)
	}

	interruptChan := make(chan os.Signal, 1)
	signal.Notify(interruptChan, os.Interrupt)
	go func() {
		_ = <-interruptChan

		Shutdown(memProfilePath)

		if onInterruptFn != nil {
			onInterruptFn()
		}

		os.Exit(1)
	}()

	config := NewConfigLocal()

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
		if debug {
			// Turn on debugging.  TODO: allow a proper log file and
			// style to be specified.
			lg.Configure("", true, "")
		}
		return lg
	})

	libkb.G.Init()
	libkb.G.ConfigureConfig()
	libkb.G.ConfigureLogging()
	libkb.G.ConfigureCaches()
	libkb.G.ConfigureMerkleClient()

	mdServer, err := makeMDServer(config, serverRootDir)
	if err != nil {
		return nil, fmt.Errorf("problem creating MD server: %v", err)
	}
	config.SetMDServer(mdServer)

	keyServer, err := makeKeyServer(config, serverRootDir)
	if err != nil {
		return nil, fmt.Errorf("problem creating key server: %v", err)
	}

	if registry := config.MetricsRegistry(); registry != nil {
		keyServer = NewKeyServerMeasured(keyServer, registry)
	}

	config.SetKeyServer(keyServer)

	client.InitUI()
	libkb.G.UI.Configure()

	k, err := makeKBPKIClient(config, serverRootDir, localUser)
	if err != nil {
		return nil, fmt.Errorf("problem creating KBPKI client: %s", err)
	}

	if registry := config.MetricsRegistry(); registry != nil {
		k = NewKbpkiMeasured(k, registry)
	}

	config.SetKBPKI(k)

	if localUser == "" {
		c, err := NewCryptoClient(config, libkb.G)
		if err != nil {
			return nil, fmt.Errorf("Could not get Crypto: %v", err)
		}
		config.SetCrypto(c)
	} else {
		signingKey := MakeLocalUserSigningKeyOrBust(localUser)
		cryptPrivateKey := MakeLocalUserCryptPrivateKeyOrBust(localUser)
		config.SetCrypto(NewCryptoLocal(config, signingKey, cryptPrivateKey))
	}

	bserv, err := makeBlockServer(config, serverRootDir)
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
