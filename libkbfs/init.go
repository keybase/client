package libkbfs

import (
	"fmt"
	"os"
	"os/signal"
	"runtime/pprof"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/protocol/go"
)

// Init initializes a config and returns it. If localUser is
// non-empty, libkbfs does not communicate to any remote servers and
// instead uses fake implementations of various servers.
//
// Init should be called at the beginning of main. Shutdown (see
// below) should then be called at the end of main (usually via
// defer).
func Init(localUser, cpuProfilePath, memProfilePath string) (Config, error) {
	if cpuProfilePath != "" {
		// Let the GC/OS clean up the file handle.
		f, err := os.Create(cpuProfilePath)
		if err != nil {
			return nil, err
		}
		pprof.StartCPUProfile(f)
	}

	sigchan := make(chan os.Signal, 1)
	signal.Notify(sigchan, os.Interrupt, os.Kill)
	go func() {
		_ = <-sigchan

		Shutdown(memProfilePath)

		os.Exit(1)
	}()

	config := NewConfigLocal()
	mdserv, err := NewMDServerLocal(config, "kbfs_handles",
		"kbfs_dirs", "kbfs_md", "kbfs_unmerged")
	if err != nil {
		return nil, fmt.Errorf("cannot open MD database: %v", err)
	}
	config.SetMDServer(mdserv)

	bserv, err := NewBlockServerLocal(config, "kbfs_block")
	if err != nil {
		return nil, fmt.Errorf("cannot open block database: %v", err)
	}
	config.SetBlockServer(bserv)

	kops, err := NewKeyServerLocal(config.Codec(), "kbfs_keys")
	if err != nil {
		return nil, fmt.Errorf("cannot open key database: %v", err)
	}
	config.SetKeyOps(kops)

	libkb.G.Init()
	libkb.G.ConfigureConfig()
	libkb.G.ConfigureLogging()
	libkb.G.ConfigureCaches()
	libkb.G.ConfigureMerkleClient()

	client.InitUI()
	libkb.G.UI.Configure()

	if localUser == "" {
		libkb.G.ConfigureSocketInfo()
		k, err := NewKBPKIClient(libkb.G)
		if err != nil {
			return nil, fmt.Errorf("Could not get KBPKI: %v", err)
		}
		config.SetKBPKI(k)

		c, err := NewCryptoClient(config.Codec(), libkb.G)
		if err != nil {
			return nil, fmt.Errorf("Could not get Crypto: %v", err)
		}
		config.SetCrypto(c)

		return config, nil
	}

	// localUser != ""

	users := []string{"strib", "max", "chris", "fred"}
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

	k := NewKBPKILocal(localUID, localUsers)
	config.SetKBPKI(k)

	signingKey := MakeLocalUserSigningKeyOrBust(localUser)
	cryptPrivateKey := MakeLocalUserCryptPrivateKeyOrBust(localUser)
	config.SetCrypto(NewCryptoLocal(config.Codec(), signingKey, cryptPrivateKey))

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
