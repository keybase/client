package libkbfs

import (
	"errors"
	"os"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
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

func updateNewRootMetadataForTest(
	rmd *RootMetadata, d *TlfHandle, id TlfID) *RootMetadata {
	updateNewRootMetadata(rmd, d, id)
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

// NewRootMetadataForTest returns a new initialized RootMetadata object for testing.
func NewRootMetadataForTest(d *TlfHandle, id TlfID) *RootMetadata {
	var rmd RootMetadata
	updateNewRootMetadataForTest(&rmd, d, id)
	return &rmd
}

func setTestLogger(config Config, t logger.TestLogBackend) {
	config.SetLoggerMaker(func(m string) logger.Logger {
		return logger.NewTestLogger(t)
	})
}

// MakeTestConfigOrBust creates and returns a config suitable for
// unit-testing with the given list of users.
func MakeTestConfigOrBust(t logger.TestLogBackend,
	users ...libkb.NormalizedUsername) *ConfigLocal {
	config := NewConfigLocal()
	setTestLogger(config, t)

	kbfsOps := NewKBFSOpsStandard(config)
	config.SetKBFSOps(kbfsOps)
	config.SetNotifier(kbfsOps)

	config.SetBlockSplitter(&BlockSplitterSimple{64 * 1024, 8 * 1024})
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
			NewBlockServerRemote(config, bserverAddr)
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
		mdServer = NewMDServerRemote(config, mdServerAddr)
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

	// turn off background flushing by default during tests
	config.noBGFlush = true

	// no auto reclamation
	config.qrPeriod = 0 * time.Second

	configs := []Config{config}
	config.allKnownConfigsForTesting = &configs

	return config
}

// ConfigAsUser clones a test configuration, setting another user as
// the logged in user
func ConfigAsUser(config *ConfigLocal, loggedInUser libkb.NormalizedUsername) *ConfigLocal {
	c := NewConfigLocal()
	c.SetLoggerMaker(config.loggerFn)

	kbfsOps := NewKBFSOpsStandard(c)
	c.SetKBFSOps(kbfsOps)
	c.SetNotifier(kbfsOps)

	c.SetBlockSplitter(config.BlockSplitter())
	c.SetKeyManager(NewKeyManagerStandard(c))
	c.SetClock(config.Clock())

	daemon := config.KeybaseDaemon().(*KeybaseDaemonLocal)
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
		blockServer := NewBlockServerRemote(c, s.RemoteAddress())
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
		mdServer = NewMDServerRemote(c, mdServerAddr)
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

	// Keep track of all the other configs in a shared slice.
	c.allKnownConfigsForTesting = config.allKnownConfigsForTesting
	*c.allKnownConfigsForTesting = append(*c.allKnownConfigsForTesting, c)

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
func NewFolder(t logger.TestLogBackend, x byte, revision MetadataRevision, share bool, public bool) (
	TlfID, *TlfHandle, *RootMetadataSigned) {
	id := FakeTlfID(x, public)
	h, rmds := NewFolderWithIDAndWriter(t, id, revision, share, public, keybase1.MakeTestUID(15))
	return id, h, rmds
}

// NewFolderWithID returns a new RootMetadataSigned for testing.
func NewFolderWithID(t logger.TestLogBackend, id TlfID, revision MetadataRevision, share bool, public bool) (
	*TlfHandle, *RootMetadataSigned) {
	return NewFolderWithIDAndWriter(t, id, revision, share, public, keybase1.MakeTestUID(15))
}

// NewFolderWithIDAndWriter returns a new RootMetadataSigned for testing.
func NewFolderWithIDAndWriter(t logger.TestLogBackend, id TlfID, revision MetadataRevision,
	share bool, public bool, writer keybase1.UID) (*TlfHandle, *RootMetadataSigned) {

	h := NewTlfHandle()
	if public {
		h.Readers = []keybase1.UID{keybase1.PublicUID}
	}
	h.Writers = append(h.Writers, writer)
	if share {
		h.Writers = append(h.Writers, keybase1.MakeTestUID(16))
	}

	rmds := &RootMetadataSigned{}
	updateNewRootMetadataForTest(&rmds.MD, h, id)
	rmds.MD.Revision = revision
	rmds.MD.LastModifyingWriter = h.Writers[0]
	rmds.MD.LastModifyingUser = h.Writers[0]
	if !public {
		AddNewKeysOrBust(t, &rmds.MD, *NewTLFKeyBundle())
	}

	rmds.SigInfo = SignatureInfo{
		Version:      SigED25519,
		Signature:    []byte{42},
		VerifyingKey: MakeFakeVerifyingKeyOrBust("fake key"),
	}
	return h, rmds
}

// AddNewKeysOrBust adds new keys to root metadata and blows up on error.
func AddNewKeysOrBust(t logger.TestLogBackend, rmd *RootMetadata, tkb TLFKeyBundle) {
	if err := rmd.AddNewKeys(tkb); err != nil {
		t.Fatal(err)
	}
}

func keySaltForUserDevice(name libkb.NormalizedUsername,
	index int) libkb.NormalizedUsername {
	if index > 0 {
		// We can't include the device index when it's 0, because we
		// have to match what's done in MakeLocalUsers.
		return libkb.NormalizedUsername(string(name) + " " + string(index))
	}
	return name
}

// AddDeviceForLocalUserOrBust creates a new device for a user and
// returns the index for that device.
func AddDeviceForLocalUserOrBust(t logger.TestLogBackend, config Config,
	uid keybase1.UID) int {
	kbd, ok := config.KeybaseDaemon().(*KeybaseDaemonLocal)
	if !ok {
		t.Fatalf("Bad keybase daemon")
	}

	user, err := kbd.getLocalUser(uid)
	if err != nil {
		t.Fatalf("No such user %s: %v", uid, err)
	}

	index := len(user.VerifyingKeys)
	keySalt := keySaltForUserDevice(user.Name, index)
	newVerifyingKey := MakeLocalUserVerifyingKeyOrBust(keySalt)
	user.VerifyingKeys = append(user.VerifyingKeys, newVerifyingKey)
	newCryptPublicKey := MakeLocalUserCryptPublicKeyOrBust(keySalt)
	user.CryptPublicKeys = append(user.CryptPublicKeys, newCryptPublicKey)

	kbd.setLocalUser(uid, user)

	return index
}

// RevokeDeviceForLocalUserOrBust revokes a device for a user in the
// given index.
func RevokeDeviceForLocalUserOrBust(t logger.TestLogBackend, config Config,
	uid keybase1.UID, index int) {
	kbd, ok := config.KeybaseDaemon().(*KeybaseDaemonLocal)
	if !ok {
		t.Fatalf("Bad keybase daemon")
	}

	user, err := kbd.getLocalUser(uid)
	if err != nil {
		t.Fatalf("No such user %s: %v", uid, err)
	}

	if index >= len(user.VerifyingKeys) ||
		(kbd.currentUID == uid && index == user.CurrentCryptPublicKeyIndex) {
		t.Fatalf("Can't revoke index %d", index)
	}

	if user.RevokedVerifyingKeys == nil {
		user.RevokedVerifyingKeys = make(map[VerifyingKey]keybase1.KeybaseTime)
	}
	if user.RevokedCryptPublicKeys == nil {
		user.RevokedCryptPublicKeys =
			make(map[CryptPublicKey]keybase1.KeybaseTime)
	}

	kbtime := keybase1.KeybaseTime{
		Unix:  keybase1.ToTime(config.Clock().Now()),
		Chain: 100,
	}
	user.RevokedVerifyingKeys[user.VerifyingKeys[index]] = kbtime
	user.RevokedCryptPublicKeys[user.CryptPublicKeys[index]] = kbtime

	user.VerifyingKeys = append(user.VerifyingKeys[:index],
		user.VerifyingKeys[index+1:]...)
	user.CryptPublicKeys = append(user.CryptPublicKeys[:index],
		user.CryptPublicKeys[index+1:]...)

	if kbd.currentUID == uid && index < user.CurrentCryptPublicKeyIndex {
		user.CurrentCryptPublicKeyIndex--
	}
	if kbd.currentUID == uid && index < user.CurrentVerifyingKeyIndex {
		user.CurrentVerifyingKeyIndex--
	}

	kbd.setLocalUser(uid, user)
}

// SwitchDeviceForLocalUserOrBust switches the current user's current device
func SwitchDeviceForLocalUserOrBust(t logger.TestLogBackend, config Config, index int) {
	_, uid, err := config.KBPKI().GetCurrentUserInfo(context.Background())
	if err != nil {
		t.Fatalf("Couldn't get UID: %v", err)
	}

	kbd, ok := config.KeybaseDaemon().(*KeybaseDaemonLocal)
	if !ok {
		t.Fatalf("Bad keybase daemon")
	}

	user, err := kbd.getLocalUser(uid)
	if err != nil {
		t.Fatalf("No such user %s: %v", uid, err)
	}

	if index >= len(user.CryptPublicKeys) {
		t.Fatalf("Wrong crypt public key index: %d", index)
	}
	user.CurrentCryptPublicKeyIndex = index

	if index >= len(user.VerifyingKeys) {
		t.Fatalf("Wrong verifying key index: %d", index)
	}
	user.CurrentVerifyingKeyIndex = index

	kbd.setLocalUser(uid, user)

	crypto, ok := config.Crypto().(*CryptoLocal)
	if !ok {
		t.Fatalf("Bad crypto")
	}

	keySalt := keySaltForUserDevice(user.Name, index)
	crypto.signingKey = MakeLocalUserSigningKeyOrBust(keySalt)
	crypto.cryptPrivateKey = MakeLocalUserCryptPrivateKeyOrBust(keySalt)
}

func testWithCanceledContext(t logger.TestLogBackend, ctx context.Context,
	readyChan <-chan struct{}, fn func(context.Context) error) {
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
}

// MakeDirRKeyBundle creates a new bundle with a reader key.
func MakeDirRKeyBundle(uid keybase1.UID, cryptPublicKey CryptPublicKey) TLFKeyBundle {
	return TLFKeyBundle{
		TLFReaderKeyBundle: &TLFReaderKeyBundle{
			RKeys: UserDeviceKeyInfoMap{
				uid: {
					cryptPublicKey.kid: TLFCryptKeyInfo{},
				},
			},
		},
		TLFWriterKeyBundle: &TLFWriterKeyBundle{
			TLFEphemeralPublicKeys: make([]TLFEphemeralPublicKey, 1),
		},
	}
}

// MakeDirWKeyBundle creates a new bundle with a writer key.
func MakeDirWKeyBundle(uid keybase1.UID, cryptPublicKey CryptPublicKey) TLFKeyBundle {
	return TLFKeyBundle{
		TLFWriterKeyBundle: &TLFWriterKeyBundle{
			WKeys: UserDeviceKeyInfoMap{
				uid: {
					cryptPublicKey.kid: TLFCryptKeyInfo{},
				},
			},
			TLFEphemeralPublicKeys: make([]TLFEphemeralPublicKey, 1),
		},
		TLFReaderKeyBundle: &TLFReaderKeyBundle{
			RKeys: make(UserDeviceKeyInfoMap, 0),
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

	ops := kbfsOps.getOpsNoAdd(folderBranch)
	c := make(chan struct{})
	ops.updatePauseChan <- c
	return c, nil
}

// DisableCRForTesting stops conflict resolution for the given folder.
// RestartCRForTesting should be called to restart it.
func DisableCRForTesting(config Config, folderBranch FolderBranch) error {
	kbfsOps, ok := config.KBFSOps().(*KBFSOpsStandard)
	if !ok {
		return errors.New("Unexpected KBFSOps type")
	}

	ops := kbfsOps.getOpsNoAdd(folderBranch)
	ops.cr.Pause()
	return nil
}

// RestartCRForTesting re-enables conflict resolution for the given
// folder.
func RestartCRForTesting(config Config, folderBranch FolderBranch) error {
	kbfsOps, ok := config.KBFSOps().(*KBFSOpsStandard)
	if !ok {
		return errors.New("Unexpected KBFSOps type")
	}

	ops := kbfsOps.getOpsNoAdd(folderBranch)
	ops.cr.Restart()
	// Start a resolution for anything we've missed.
	if ops.staged {
		lState := makeFBOLockState()
		ops.cr.Resolve(ops.getCurrMDRevision(lState), MetadataRevisionUninitialized)
	}
	return nil
}

// ForceQuotaReclamationForTesting kicks off quota reclamation under
// the given config, for the given folder-branch.
func ForceQuotaReclamationForTesting(config Config,
	folderBranch FolderBranch) error {
	kbfsOps, ok := config.KBFSOps().(*KBFSOpsStandard)
	if !ok {
		return errors.New("Unexpected KBFSOps type")
	}

	ops := kbfsOps.getOpsNoAdd(folderBranch)
	ops.fbm.forceQuotaReclamation()
	return nil
}

// TestClock returns a set time as the current time.
type TestClock struct {
	T time.Time
}

// Now implements the Clock interface for TestClock.
func (tc TestClock) Now() time.Time {
	return tc.T
}

// CheckConfigAndShutdown shuts down the given config, but fails the
// test if there's an error.
func CheckConfigAndShutdown(t logger.TestLogBackend, config Config) {
	if err := config.Shutdown(); err != nil {
		t.Errorf(err.Error())
	}
}
