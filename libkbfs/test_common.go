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
	// EnvTestMDServerAddr is the environment variable name for an mdserver address.
	EnvTestMDServerAddr = "KEYBASE_TEST_MDSERVER_ADDR"
	// EnvTestBServerAddr is the environment variable name for a block
	// server address.
	EnvTestBServerAddr = "KEYBASE_TEST_BSERVER_ADDR"
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

	config.SetKeyManager(NewKeyManagerStandard(config))

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
	bserverAddr := os.Getenv(EnvTestBServerAddr)
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
	mdServerAddr := os.Getenv(EnvTestMDServerAddr)

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
	c.SetRootCerts(config.RootCerts())

	c.SetKeyManager(NewKeyManagerStandard(c))

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
	mdServerAddr := os.Getenv(EnvTestMDServerAddr)

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
		AddNewKeysOrBust(t, rmd, TLFKeyBundle{})
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
func AddNewKeysOrBust(t *testing.T, rmd *RootMetadata, tkb TLFKeyBundle) {
	if err := rmd.AddNewKeys(tkb); err != nil {
		t.Fatal(err)
	}
}

// AddDeviceForLocalUserOrBust creates a new device for a user and
// returns the index for that device.
func AddDeviceForLocalUserOrBust(t *testing.T, config Config,
	uid keybase1.UID) int {
	kbd, ok := config.KeybaseDaemon().(KeybaseDaemonLocal)
	if !ok {
		t.Fatalf("Bad keybase daemon")
	}

	user, ok := kbd.localUsers[uid]
	if !ok {
		t.Fatalf("No such user: %s", uid)
	}

	index := len(user.VerifyingKeys)
	keySalt := libkb.NormalizedUsername(string(user.Name) + " " + string(index))
	newVerifyingKey := MakeLocalUserVerifyingKeyOrBust(keySalt)
	user.VerifyingKeys = append(user.VerifyingKeys, newVerifyingKey)
	newCryptPublicKey := MakeLocalUserCryptPublicKeyOrBust(keySalt)
	user.CryptPublicKeys = append(user.CryptPublicKeys, newCryptPublicKey)

	// kbd is just a copy, but kbd.localUsers is the same map
	kbd.localUsers[uid] = user

	return index
}

// RevokeDeviceForLocalUserOrBust revokes a device for a user in the
// given index.
func RevokeDeviceForLocalUserOrBust(t *testing.T, config Config,
	uid keybase1.UID, index int) {
	kbd, ok := config.KeybaseDaemon().(KeybaseDaemonLocal)
	if !ok {
		t.Fatalf("Bad keybase daemon")
	}

	user, ok := kbd.localUsers[uid]
	if !ok {
		t.Fatalf("No such user: %s", uid)
	}

	if index >= len(user.VerifyingKeys) ||
		(kbd.currentUID == uid && index == user.CurrentCryptPublicKeyIndex) {
		t.Fatalf("Can't revoke index %d", index)
	}

	user.VerifyingKeys = append(user.VerifyingKeys[:index],
		user.VerifyingKeys[index+1:]...)
	user.CryptPublicKeys = append(user.CryptPublicKeys[:index],
		user.CryptPublicKeys[index+1:]...)

	if kbd.currentUID == uid && index < user.CurrentCryptPublicKeyIndex {
		user.CurrentCryptPublicKeyIndex--
	}

	// kbd is just a copy, but kbd.localUsers is the same map
	kbd.localUsers[uid] = user
}

// SwitchDeviceForLocalUserOrBust switches the current user's current device
func SwitchDeviceForLocalUserOrBust(t *testing.T, config Config, index int) {
	uid, err := config.KBPKI().GetCurrentUID(context.Background())
	if err != nil {
		t.Fatalf("Couldn't get UID: %v", err)
	}

	kbd, ok := config.KeybaseDaemon().(KeybaseDaemonLocal)
	if !ok {
		t.Fatalf("Bad keybase daemon")
	}

	user, ok := kbd.localUsers[uid]
	if !ok {
		t.Fatalf("No such user: %s", uid)
	}

	if index >= len(user.CryptPublicKeys) {
		t.Fatalf("Wrong crypt public key index: %d", index)
	}
	user.CurrentCryptPublicKeyIndex = index

	// kbd is just a copy, but kbd.localUsers is the same map
	kbd.localUsers[uid] = user

	crypto, ok := config.Crypto().(*CryptoLocal)
	if !ok {
		t.Fatalf("Bad crypto")
	}

	keySalt := user.Name
	if index > 0 {
		keySalt = libkb.NormalizedUsername(string(user.Name) + " " +
			string(index))
	}
	crypto.signingKey = MakeLocalUserSigningKeyOrBust(keySalt)
	crypto.cryptPrivateKey = MakeLocalUserCryptPrivateKeyOrBust(keySalt)
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
func MakeDirRKeyBundle(uid keybase1.UID, cryptPublicKey CryptPublicKey) TLFKeyBundle {
	return TLFKeyBundle{
		RKeys: map[keybase1.UID]UserCryptKeyBundle{
			uid: UserCryptKeyBundle{
				cryptPublicKey.KID: TLFCryptKeyInfo{},
			},
		},
		TLFEphemeralPublicKeys: make([]TLFEphemeralPublicKey, 1),
	}
}

// MakeDirWKeyBundle creates a new bundle with a writer key.
func MakeDirWKeyBundle(uid keybase1.UID, cryptPublicKey CryptPublicKey) TLFKeyBundle {
	return TLFKeyBundle{
		WKeys: map[keybase1.UID]UserCryptKeyBundle{
			uid: UserCryptKeyBundle{
				cryptPublicKey.KID: TLFCryptKeyInfo{},
			},
		},
		TLFEphemeralPublicKeys: make([]TLFEphemeralPublicKey, 1),
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
