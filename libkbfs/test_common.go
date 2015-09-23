package libkbfs

import (
	"errors"
	"os"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/net/context"
)

const (
	// EnvMDServerAddr is the environment variable name for an mdserver address.
	EnvMDServerAddr = "KEYBASE_MDSERVER_BIND_ADDR"
	// EnvBServerAddr is the environment variable name for a block
	// server address.
	EnvBServerAddr = "KEYBASE_BSERVER_BIND_ADDR"
	// EnvMDServerCACertPEM is the environment variable name for the CA cert
	// PEM the client uses to verify the KBFS md servers.
	EnvMDServerCACertPEM = "KEYBASE_MDSERVER_CA_CERT_PEM"
	// EnvBServerCACertPEM is the environment variable name for the CA cert
	// PEM the client uses to verify the KBFS block servers.
	EnvBServerCACertPEM = "KEYBASE_BSERVER_CA_CERT_PEM"
)

// RandomBlockID returns a randomly-generated BlockID for testing.
func RandomBlockID() BlockID {
	var dh RawDefaultHash
	err := cryptoRandRead(dh[:])
	if err != nil {
		panic(err)
	}
	h, err := HashFromRaw(DefaultHashType, dh[:])
	if err != nil {
		panic(err)
	}
	return BlockID{h}
}

func fakeMdID(b byte) MdID {
	dh := RawDefaultHash{b}
	h, err := HashFromRaw(DefaultHashType, dh[:])
	if err != nil {
		panic(err)
	}
	return MdID{h}
}

// NewRootMetadataForTest returns a new initialized RootMetadata object for testing.
func NewRootMetadataForTest(d *TlfHandle, id TlfID) *RootMetadata {
	rmd := NewRootMetadata(d, id)
	var keyGen KeyGen
	if id.IsPublic() {
		keyGen = PublicKeyGen
	} else {
		keyGen = 1
	}
	rmd.data.Dir = DirEntry{
		BlockInfo: BlockInfo{
			BlockPointer: BlockPointer{
				KeyGen:  keyGen,
				DataVer: 1,
			},
			EncodedSize: 1,
		},
	}
	// make up the MD ID
	rmd.mdID = fakeMdID(fakeTlfIDByte(id))
	return rmd
}

func setTestLogger(config Config, t *testing.T) {
	config.SetLoggerMaker(func(m string) logger.Logger {
		return logger.NewTestLogger(t)
	})
}

// MakeTestConfigOrBust creates and returns a config suitable for
// unit-testing with the given list of users.
func MakeTestConfigOrBust(t *testing.T, users ...libkb.NormalizedUsername) *ConfigLocal {
	config := NewConfigLocal()
	setTestLogger(config, t)

	localUsers := MakeLocalUsers(users)
	loggedInUser := localUsers[0]

	daemon := NewKeybaseDaemonMemory(loggedInUser.UID, localUsers)
	config.SetKeybaseDaemon(daemon)

	kbpki := NewKBPKIClient(config)
	config.SetKBPKI(kbpki)

	signingKey := MakeLocalUserSigningKeyOrBust(loggedInUser.Name)
	cryptPrivateKey := MakeLocalUserCryptPrivateKeyOrBust(loggedInUser.Name)
	crypto := NewCryptoLocal(config, signingKey, cryptPrivateKey)
	config.SetCrypto(crypto)

	// see if a local remote server is specified
	bserverAddr := os.Getenv(EnvBServerAddr)
	if len(bserverAddr) != 0 {
		blockServer :=
			NewBlockServerRemote(context.TODO(), config, bserverAddr)
		config.SetBlockServer(blockServer)
	} else {
		blockServer, err := NewBlockServerMemory(config)
		if err != nil {
			t.Fatal(err)
		}
		config.SetBlockServer(blockServer)
	}

	// see if a local remote server is specified
	mdServerAddr := os.Getenv(EnvMDServerAddr)

	var err error
	var mdServer MDServer
	var keyServer KeyServer
	if len(mdServerAddr) != 0 {
		// start/restart local in-memory DynamoDB
		runner, err := NewTestDynamoDBRunner()
		if err != nil {
			t.Fatal(err)
		}
		runner.Run(t)

		// initialize libkb -- this probably isn't the best place to do this
		// but it seems as though the MDServer rpc client is the first thing to
		// use things from it which require initialization.
		libkb.G.Init()
		libkb.G.ConfigureLogging()

		// connect to server
		mdServer = NewMDServerRemote(context.TODO(), config, mdServerAddr)
		// for now the MD server acts as the key server in production
		keyServer = mdServer.(*MDServerRemote)
	} else {
		// create in-memory server shim
		mdServer, err = NewMDServerMemory(config)
		if err != nil {
			t.Fatal(err)
		}
		// shim for the key server too
		keyServer, err = NewKeyServerMemory(config)
		if err != nil {
			t.Fatal(err)
		}
	}
	config.SetMDServer(mdServer)
	config.SetKeyServer(keyServer)

	return config
}

// ConfigAsUser clones a test configuration, setting another user as
// the logged in user
func ConfigAsUser(config *ConfigLocal, loggedInUser libkb.NormalizedUsername) *ConfigLocal {
	c := NewConfigLocal()
	c.SetLoggerMaker(config.loggerFn)

	daemon := config.KeybaseDaemon().(KeybaseDaemonLocal)
	loggedInUID, ok := daemon.asserts[string(loggedInUser)]
	if !ok {
		panic("bad test: unknown user: " + loggedInUser)
	}

	var localUsers []LocalUser
	for _, u := range daemon.localUsers {
		localUsers = append(localUsers, u)
	}
	newDaemon := NewKeybaseDaemonMemory(loggedInUID, localUsers)
	c.SetKeybaseDaemon(newDaemon)
	c.SetKBPKI(NewKBPKIClient(c))

	signingKey := MakeLocalUserSigningKeyOrBust(loggedInUser)
	cryptPrivateKey := MakeLocalUserCryptPrivateKeyOrBust(loggedInUser)
	crypto := NewCryptoLocal(config, signingKey, cryptPrivateKey)
	c.SetCrypto(crypto)

	if s, ok := config.BlockServer().(*BlockServerRemote); ok {
		blockServer := NewBlockServerRemote(context.TODO(), c, s.RemoteAddress())
		c.SetBlockServer(blockServer)
	} else {
		c.SetBlockServer(config.BlockServer())
	}

	// see if a local remote server is specified
	mdServerAddr := os.Getenv(EnvMDServerAddr)

	var mdServer MDServer
	var keyServer KeyServer
	if len(mdServerAddr) != 0 {
		// connect to server
		mdServer = NewMDServerRemote(context.TODO(), c, mdServerAddr)
		// for now the MD server also acts as the key server.
		keyServer = mdServer.(*MDServerRemote)
	} else {
		// copy the existing mdServer but update the config
		// this way the current device KID is paired with
		// the proper user yet the DB state is all shared.
		mdServerToCopy := config.MDServer().(*MDServerLocal)
		mdServer = mdServerToCopy.copy(c)

		// use the same db but swap configs
		keyServerToCopy := config.KeyServer().(*KeyServerLocal)
		keyServer = keyServerToCopy.copy(c)
	}
	c.SetMDServer(mdServer)
	c.SetKeyServer(keyServer)

	return c
}

// FakeTlfID creates a fake public or private TLF ID from the given
// byte.
func FakeTlfID(b byte, public bool) TlfID {
	bytes := [TlfIDByteLen]byte{b}
	if public {
		bytes[TlfIDByteLen-1] = PubTlfIDSuffix
	} else {
		bytes[TlfIDByteLen-1] = TlfIDSuffix
	}
	return TlfID{bytes}
}

func fakeTlfIDByte(id TlfID) byte {
	return id.id[0]
}

// NewFolder returns a new RootMetadataSigned for testing.
func NewFolder(t *testing.T, x byte, revision MetadataRevision, share bool, public bool) (
	TlfID, *TlfHandle, *RootMetadataSigned) {
	id := FakeTlfID(x, public)
	h, rmds := NewFolderWithIDAndWriter(t, id, revision, share, public, keybase1.MakeTestUID(15))
	return id, h, rmds
}

// NewFolderWithID returns a new RootMetadataSigned for testing.
func NewFolderWithID(t *testing.T, id TlfID, revision MetadataRevision, share bool, public bool) (
	*TlfHandle, *RootMetadataSigned) {
	return NewFolderWithIDAndWriter(t, id, revision, share, public, keybase1.MakeTestUID(15))
}

// NewFolderWithIDAndWriter returns a new RootMetadataSigned for testing.
func NewFolderWithIDAndWriter(t *testing.T, id TlfID, revision MetadataRevision,
	share bool, public bool, writer keybase1.UID) (*TlfHandle, *RootMetadataSigned) {

	h := NewTlfHandle()
	if public {
		h.Readers = []keybase1.UID{keybase1.PublicUID}
	}
	h.Writers = append(h.Writers, writer)
	if share {
		h.Writers = append(h.Writers, keybase1.MakeTestUID(16))
	}

	rmd := NewRootMetadataForTest(h, id)
	rmd.Revision = revision
	rmd.data.LastWriter = h.Writers[0]
	if !public {
		AddNewKeysOrBust(t, rmd, DirKeyBundle{})
	}

	rmds := &RootMetadataSigned{}
	rmds.SigInfo = SignatureInfo{
		Version:      SigED25519,
		Signature:    []byte{42},
		VerifyingKey: MakeFakeVerifyingKeyOrBust("fake key"),
	}
	rmds.MD = *rmd
	return h, rmds
}

// AddNewKeysOrBust adds new keys to root metadata and blows up on error.
func AddNewKeysOrBust(t *testing.T, rmd *RootMetadata, dkb DirKeyBundle) {
	if err := rmd.AddNewKeys(dkb); err != nil {
		t.Fatal(err)
	}
}

func testWithCanceledContext(t *testing.T, ctx context.Context,
	readyChan <-chan struct{}, goChan chan<- struct{},
	fn func(context.Context) error) {
	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		// wait for the RPC, then cancel the context
		<-readyChan
		cancel()
	}()

	err := fn(ctx)
	if err != context.Canceled {
		t.Fatalf("Function did not return a canceled error: %v", err)
	}
	// let any waiting goroutines complete, which shouldn't hurt anything
	goChan <- struct{}{}
}

// MakeDirRKeyBundle creates a new bundle with a reader key.
func MakeDirRKeyBundle(uid keybase1.UID, cryptPublicKey CryptPublicKey) DirKeyBundle {
	return DirKeyBundle{
		RKeys: map[keybase1.UID]map[keybase1.KID]TLFCryptKeyInfo{
			uid: map[keybase1.KID]TLFCryptKeyInfo{
				cryptPublicKey.KID: TLFCryptKeyInfo{},
			},
		},
	}
}

// MakeDirWKeyBundle creates a new bundle with a writer key.
func MakeDirWKeyBundle(uid keybase1.UID, cryptPublicKey CryptPublicKey) DirKeyBundle {
	return DirKeyBundle{
		WKeys: map[keybase1.UID]map[keybase1.KID]TLFCryptKeyInfo{
			uid: map[keybase1.KID]TLFCryptKeyInfo{
				cryptPublicKey.KID: TLFCryptKeyInfo{},
			},
		},
	}
}

// DisableUpdatesForTesting stops the given folder from acting on new
// updates.  Send a struct{}{} down the returned channel to restart
// notifications
func DisableUpdatesForTesting(config Config, folderBranch FolderBranch) (
	chan<- struct{}, error) {
	kbfsOps, ok := config.KBFSOps().(*KBFSOpsStandard)
	if !ok {
		return nil, errors.New("Unexpected KBFSOps type")
	}

	ops := kbfsOps.getOps(folderBranch)
	c := make(chan struct{})
	ops.updatePauseChan <- c
	return c, nil
}
