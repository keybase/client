// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"net"
	"os"
	"sync"
	"time"

	"github.com/keybase/client/go/externals"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/keybase/kbfs/env"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"golang.org/x/net/context"
)

const (
	// EnvTestMDServerAddr is the environment variable name for an
	// mdserver address.
	EnvTestMDServerAddr = "KEYBASE_TEST_MDSERVER_ADDR"
	// EnvTestBServerAddr is the environment variable name for a block
	// server address.
	EnvTestBServerAddr = "KEYBASE_TEST_BSERVER_ADDR"
	// TempdirServerAddr is the special value of the
	// EnvTest{B,MD}ServerAddr environment value to signify that
	// an on-disk implementation of the {b,md}server should be
	// used with a temporary directory.
	TempdirServerAddr = "tempdir"
)

// newConfigForTest returns a ConfigLocal object suitable for use by
// MakeTestConfigOrBust or ConfigAsUser.
//
// TODO: Move more common code here.
func newConfigForTest(modeType InitModeType, loggerFn func(module string) logger.Logger) *ConfigLocal {
	mode := modeTest{NewInitModeFromType(modeType)}
	config := NewConfigLocal(mode, loggerFn, "", DiskCacheModeOff, &env.KBFSContext{})

	bops := NewBlockOpsStandard(config,
		testBlockRetrievalWorkerQueueSize, testPrefetchWorkerQueueSize)
	config.SetBlockOps(bops)

	maxDirEntriesPerBlock, err := getMaxDirEntriesPerBlock()
	if err != nil {
		panic(err)
	}

	bsplit := &BlockSplitterSimple{
		64 * 1024, 64 * 1024 / int(bpSize), 8 * 1024, maxDirEntriesPerBlock}
	err = bsplit.SetMaxDirEntriesByBlockSize(config.Codec())
	if err != nil {
		panic(err)
	}
	config.SetBlockSplitter(bsplit)

	return config
}

// MakeTestBlockServerOrBust makes a block server from the given
// arguments and environment variables.
func MakeTestBlockServerOrBust(t logger.TestLogBackend,
	config blockServerRemoteConfig,
	rpcLogFactory rpc.LogFactory) BlockServer {
	// see if a local remote server is specified
	bserverAddr := os.Getenv(EnvTestBServerAddr)
	switch {
	case bserverAddr == TempdirServerAddr:
		var err error
		blockServer, err := NewBlockServerTempDir(config.Codec(), config.MakeLogger(""))
		if err != nil {
			t.Fatal(err)
		}
		return blockServer

	case len(bserverAddr) != 0:
		remote, err := rpc.ParsePrioritizedRoundRobinRemote(bserverAddr)
		if err != nil {
			t.Fatal(err)
		}
		return NewBlockServerRemote(config, remote, rpcLogFactory)

	default:
		return NewBlockServerMemory(config.MakeLogger(""))
	}
}

// TODO: Put the below code (also duplicated in kbfs-server) somewhere
// in rpc and use that instead.

type testLogger interface {
	Logf(format string, args ...interface{})
}

type testLogOutput struct {
	t testLogger
}

func (t testLogOutput) log(ch string, fmts string, args []interface{}) {
	fmts = fmt.Sprintf("[%s] %s", ch, fmts)
	t.t.Logf(fmts, args...)
}

func (t testLogOutput) Info(fmt string, args ...interface{})    { t.log("I", fmt, args) }
func (t testLogOutput) Error(fmt string, args ...interface{})   { t.log("E", fmt, args) }
func (t testLogOutput) Debug(fmt string, args ...interface{})   { t.log("D", fmt, args) }
func (t testLogOutput) Warning(fmt string, args ...interface{}) { t.log("W", fmt, args) }
func (t testLogOutput) Profile(fmt string, args ...interface{}) { t.log("P", fmt, args) }

func newTestRPCLogFactory(t testLogger) rpc.LogFactory {
	return rpc.NewSimpleLogFactory(testLogOutput{t}, nil)
}

// MakeTestConfigOrBustLoggedInWithMode creates and returns a config
// suitable for unit-testing with the given mode and list of
// users. loggedInIndex specifies the index (in the list) of the user
// being logged in.
func MakeTestConfigOrBustLoggedInWithMode(
	t logger.TestLogBackend, loggedInIndex int,
	mode InitModeType, users ...kbname.NormalizedUsername) *ConfigLocal {
	log := logger.NewTestLogger(t)
	config := newConfigForTest(mode, func(m string) logger.Logger {
		return log
	})

	kbfsOps := NewKBFSOpsStandard(env.EmptyAppStateUpdater{}, config)
	config.SetKBFSOps(kbfsOps)
	config.SetNotifier(kbfsOps)

	config.SetKeyManager(NewKeyManagerStandard(config))
	config.SetMDOps(NewMDOpsStandard(config))

	localUsers := MakeLocalUsers(users)
	loggedInUser := localUsers[loggedInIndex]

	daemon := NewKeybaseDaemonMemory(loggedInUser.UID, localUsers, nil,
		config.Codec())
	config.SetKeybaseService(daemon)
	config.SetChat(newChatLocal(config))

	kbpki := NewKBPKIClient(config, config.MakeLogger(""))
	config.SetKBPKI(kbpki)

	kbfsOps.favs.Initialize(context.TODO())

	signingKey := MakeLocalUserSigningKeyOrBust(loggedInUser.Name)
	cryptPrivateKey := MakeLocalUserCryptPrivateKeyOrBust(loggedInUser.Name)
	crypto := NewCryptoLocal(
		config.Codec(), signingKey, cryptPrivateKey, config)
	config.SetCrypto(crypto)

	blockServer := MakeTestBlockServerOrBust(
		t, config, newTestRPCLogFactory(t))
	config.SetBlockServer(blockServer)

	// see if a local remote server is specified
	mdServerAddr := os.Getenv(EnvTestMDServerAddr)
	var mdServer MDServer
	var keyServer KeyServer
	switch {
	case mdServerAddr == TempdirServerAddr:
		var err error
		mdServer, err = NewMDServerTempDir(
			mdServerLocalConfigAdapter{config})
		if err != nil {
			t.Fatal(err)
		}
		keyServer, err = NewKeyServerTempDir(
			mdServerLocalConfigAdapter{config})
		if err != nil {
			t.Fatal(err)
		}

	case len(mdServerAddr) != 0:
		remote, err := rpc.ParsePrioritizedRoundRobinRemote(mdServerAddr)
		if err != nil {
			t.Fatal(err)
		}
		// connect to server
		mdServer = NewMDServerRemote(config, remote, newTestRPCLogFactory(t))
		// for now the MD server acts as the key server in production
		keyServer = mdServer.(*MDServerRemote)

	default:
		var err error
		// create in-memory server shim
		mdServer, err = NewMDServerMemory(
			mdServerLocalConfigAdapter{config})
		if err != nil {
			t.Fatal(err)
		}
		// shim for the key server too
		keyServer, err = NewKeyServerMemory(
			mdServerLocalConfigAdapter{config})
		if err != nil {
			t.Fatal(err)
		}
	}
	config.SetMDServer(mdServer)
	config.SetKeyServer(keyServer)

	// turn off background flushing by default during tests
	config.noBGFlush = true

	configs := []Config{config}
	config.allKnownConfigsForTesting = &configs

	return config
}

// MakeTestConfigOrBustLoggedIn creates and returns a config suitable for
// unit-testing with the given list of users. loggedInIndex specifies the
// index (in the list) of the user being logged in.
func MakeTestConfigOrBustLoggedIn(t logger.TestLogBackend, loggedInIndex int,
	users ...kbname.NormalizedUsername) *ConfigLocal {
	return MakeTestConfigOrBustLoggedInWithMode(
		t, loggedInIndex, InitDefault, users...)
}

// MakeTestConfigOrBust creates and returns a config suitable for
// unit-testing with the given list of users.
func MakeTestConfigOrBust(t logger.TestLogBackend,
	users ...kbname.NormalizedUsername) *ConfigLocal {
	return MakeTestConfigOrBustLoggedIn(t, 0, users...)
}

// ConfigAsUserWithMode clones a test configuration in the given mode,
// setting another user as the logged in user.  Journaling will not be
// enabled in the returned Config, regardless of the journal status in
// `config`.
func ConfigAsUserWithMode(config *ConfigLocal,
	loggedInUser kbname.NormalizedUsername, mode InitModeType) *ConfigLocal {
	c := newConfigForTest(mode, config.loggerFn)
	c.SetMetadataVersion(config.MetadataVersion())
	c.SetRekeyWithPromptWaitTime(config.RekeyWithPromptWaitTime())

	kbfsOps := NewKBFSOpsStandard(env.EmptyAppStateUpdater{}, c)
	c.SetKBFSOps(kbfsOps)
	c.SetNotifier(kbfsOps)

	c.SetKeyManager(NewKeyManagerStandard(c))
	c.SetMDOps(NewMDOpsStandard(c))
	c.SetClock(config.Clock())

	if chatLocal, ok := config.Chat().(*chatLocal); ok {
		c.SetChat(chatLocal.copy(c))
	} else {
		c.SetChat(config.Chat())
	}

	daemon := config.KeybaseService().(*KeybaseDaemonLocal)
	loggedInUID, ok := daemon.asserts[string(loggedInUser)]
	if !ok {
		panic("bad test: unknown user: " + loggedInUser)
	}

	var localUsers []LocalUser
	for _, u := range daemon.localUsers {
		localUsers = append(localUsers, u)
	}
	newDaemon := NewKeybaseDaemonMemory(
		loggedInUID.AsUserOrBust(), localUsers, nil, c.Codec())
	c.SetKeybaseService(newDaemon)
	c.SetKBPKI(NewKBPKIClient(c, c.MakeLogger("")))
	kbfsOps.favs.InitForTest()

	signingKey := MakeLocalUserSigningKeyOrBust(loggedInUser)
	cryptPrivateKey := MakeLocalUserCryptPrivateKeyOrBust(loggedInUser)
	crypto := NewCryptoLocal(
		config.Codec(), signingKey, cryptPrivateKey, config)
	c.SetCrypto(crypto)
	c.noBGFlush = config.noBGFlush

	if s, ok := config.BlockServer().(*BlockServerRemote); ok {
		remote, err := rpc.ParsePrioritizedRoundRobinRemote(s.RemoteAddress())
		if err != nil {
			panic(err)
		}
		blockServer := NewBlockServerRemote(c, remote, s.putConn.rpcLogFactory)
		c.SetBlockServer(blockServer)
	} else {
		c.SetBlockServer(config.BlockServer())
	}

	// If journaling was on in `config`, disable it in `c`.
	jServer, err := GetJournalServer(config)
	if err == nil {
		c.SetBlockServer(jServer.delegateBlockServer)
	}

	var mdServer MDServer
	var keyServer KeyServer
	if s, ok := config.MDServer().(*MDServerRemote); ok {
		remote, err := rpc.ParsePrioritizedRoundRobinRemote(s.RemoteAddress())
		if err != nil {
			panic(err)
		}
		// connect to server
		mdServer = NewMDServerRemote(c, remote, s.rpcLogFactory)
		// for now the MD server also acts as the key server.
		keyServer = mdServer.(*MDServerRemote)
	} else {
		// copy the existing mdServer but update the config
		// this way the current device key is paired with
		// the proper user yet the DB state is all shared.
		mdServerToCopy := config.MDServer().(mdServerLocal)
		mdServer = mdServerToCopy.copy(mdServerLocalConfigAdapter{c})

		// use the same db but swap configs
		keyServerToCopy := config.KeyServer().(*KeyServerLocal)
		keyServer = keyServerToCopy.copy(mdServerLocalConfigAdapter{c})
	}
	c.SetMDServer(mdServer)
	c.SetKeyServer(keyServer)

	// Keep track of all the other configs in a shared slice.
	c.allKnownConfigsForTesting = config.allKnownConfigsForTesting
	*c.allKnownConfigsForTesting = append(*c.allKnownConfigsForTesting, c)

	return c
}

// ConfigAsUser clones a test configuration in default init mode,
// setting another user as the logged in user.  Journaling will not be
// enabled in the returned Config, regardless of the journal status in
// `config`.
func ConfigAsUser(config *ConfigLocal,
	loggedInUser kbname.NormalizedUsername) *ConfigLocal {
	c := ConfigAsUserWithMode(config, loggedInUser, config.Mode().Type())
	c.mode = config.mode // preserve any unusual test mode wrappers
	return c
}

// NewEmptyTLFWriterKeyBundle creates a new empty kbfsmd.TLFWriterKeyBundleV2
func NewEmptyTLFWriterKeyBundle() kbfsmd.TLFWriterKeyBundleV2 {
	return kbfsmd.TLFWriterKeyBundleV2{
		WKeys: make(kbfsmd.UserDeviceKeyInfoMapV2, 0),
	}
}

// NewEmptyTLFReaderKeyBundle creates a new empty kbfsmd.TLFReaderKeyBundleV2
func NewEmptyTLFReaderKeyBundle() kbfsmd.TLFReaderKeyBundleV2 {
	return kbfsmd.TLFReaderKeyBundleV2{
		RKeys: make(kbfsmd.UserDeviceKeyInfoMapV2, 0),
	}
}

func keySaltForUserDevice(name kbname.NormalizedUsername,
	index int) kbname.NormalizedUsername {
	if index > 0 {
		// We can't include the device index when it's 0, because we
		// have to match what's done in MakeLocalUsers.
		return kbname.NormalizedUsername(string(name) + " " + string(index))
	}
	return name
}

func makeFakeKeys(name kbname.NormalizedUsername, index int) (
	kbfscrypto.CryptPublicKey, kbfscrypto.VerifyingKey) {
	keySalt := keySaltForUserDevice(name, index)
	newCryptPublicKey := MakeLocalUserCryptPublicKeyOrBust(keySalt)
	newVerifyingKey := MakeLocalUserVerifyingKeyOrBust(keySalt)
	return newCryptPublicKey, newVerifyingKey
}

// AddDeviceForLocalUserOrBust creates a new device for a user and
// returns the index for that device.
func AddDeviceForLocalUserOrBust(t logger.TestLogBackend, config Config,
	uid keybase1.UID) int {
	kbd, ok := config.KeybaseService().(*KeybaseDaemonLocal)
	if !ok {
		t.Fatal("Bad keybase daemon")
	}

	index, err := kbd.addDeviceForTesting(uid, makeFakeKeys)
	if err != nil {
		t.Fatal(err.Error())
	}
	return index
}

// RevokeDeviceForLocalUserOrBust revokes a device for a user in the
// given index.
func RevokeDeviceForLocalUserOrBust(t logger.TestLogBackend, config Config,
	uid keybase1.UID, index int) {
	kbd, ok := config.KeybaseService().(*KeybaseDaemonLocal)
	if !ok {
		t.Fatal("Bad keybase daemon")
	}

	if err := kbd.revokeDeviceForTesting(
		config.Clock(), uid, index); err != nil {
		t.Fatal(err.Error())
	}
}

// SwitchDeviceForLocalUserOrBust switches the current user's current device
func SwitchDeviceForLocalUserOrBust(t logger.TestLogBackend, config Config, index int) {
	session, err := config.KBPKI().GetCurrentSession(context.Background())
	if err != nil {
		t.Fatalf("Couldn't get UID: %+v", err)
	}

	kbd, ok := config.KeybaseService().(*KeybaseDaemonLocal)
	if !ok {
		t.Fatal("Bad keybase daemon")
	}

	if err := kbd.switchDeviceForTesting(session.UID, index); err != nil {
		t.Fatal(err.Error())
	}

	if _, ok := config.Crypto().(*CryptoLocal); !ok {
		t.Fatal("Bad crypto")
	}

	keySalt := keySaltForUserDevice(session.Name, index)
	signingKey := MakeLocalUserSigningKeyOrBust(keySalt)
	cryptPrivateKey := MakeLocalUserCryptPrivateKeyOrBust(keySalt)
	config.SetCrypto(
		NewCryptoLocal(config.Codec(), signingKey, cryptPrivateKey, config))
}

// AddNewAssertionForTest makes newAssertion, which should be a single
// assertion that doesn't already resolve to anything, resolve to the
// same UID as oldAssertion, which should be an arbitrary assertion
// that does already resolve to something.  It only applies to the
// given config.
func AddNewAssertionForTest(
	config Config, oldAssertion, newAssertion string) error {
	kbd, ok := config.KeybaseService().(*KeybaseDaemonLocal)
	if !ok {
		return errors.New("Bad keybase daemon")
	}

	uid, err := kbd.addNewAssertionForTest(oldAssertion, newAssertion)
	if err != nil {
		return err
	}

	// Let the mdserver know about the name change
	md, ok := config.MDServer().(mdServerLocal)
	if !ok {
		return errors.New("Bad md server")
	}
	// If this function is called multiple times for different
	// configs, it may end up invoking the following call more than
	// once on the shared md databases.  That's ok though, it's an
	// idempotent call.
	newSocialAssertion, ok := externals.NormalizeSocialAssertionStatic(newAssertion)
	if !ok {
		return errors.Errorf("%s couldn't be parsed as a social assertion", newAssertion)
	}
	if err := md.addNewAssertionForTest(uid, newSocialAssertion); err != nil {
		return errors.Errorf("Couldn't update md server: %+v", err)
	}
	return nil
}

// AddNewAssertionForTestOrBust is like AddNewAssertionForTest, but
// dies if there's an error.
func AddNewAssertionForTestOrBust(t logger.TestLogBackend, config Config,
	oldAssertion, newAssertion string) {
	err := AddNewAssertionForTest(config, oldAssertion, newAssertion)
	if err != nil {
		t.Fatal(err)
	}
}

// AddTeamWriterForTest makes the given user a team writer.
func AddTeamWriterForTest(
	config Config, tid keybase1.TeamID, uid keybase1.UID) error {
	kbd, ok := config.KeybaseService().(*KeybaseDaemonLocal)
	if !ok {
		return errors.New("Bad keybase daemon")
	}

	return kbd.addTeamWriterForTest(tid, uid)
}

// AddTeamWriterForTestOrBust is like AddTeamWriterForTest, but
// dies if there's an error.
func AddTeamWriterForTestOrBust(t logger.TestLogBackend, config Config,
	tid keybase1.TeamID, uid keybase1.UID) {
	err := AddTeamWriterForTest(config, tid, uid)
	if err != nil {
		t.Fatal(err)
	}
}

// RemoveTeamWriterForTest removes the given user from a team.
func RemoveTeamWriterForTest(
	config Config, tid keybase1.TeamID, uid keybase1.UID) error {
	kbd, ok := config.KeybaseService().(*KeybaseDaemonLocal)
	if !ok {
		return errors.New("Bad keybase daemon")
	}

	return kbd.removeTeamWriterForTest(tid, uid)
}

// RemoveTeamWriterForTestOrBust is like RemoveTeamWriterForTest, but
// dies if there's an error.
func RemoveTeamWriterForTestOrBust(t logger.TestLogBackend, config Config,
	tid keybase1.TeamID, uid keybase1.UID) {
	err := RemoveTeamWriterForTest(config, tid, uid)
	if err != nil {
		t.Fatal(err)
	}
}

// AddTeamReaderForTest makes the given user a team reader.
func AddTeamReaderForTest(
	config Config, tid keybase1.TeamID, uid keybase1.UID) error {
	kbd, ok := config.KeybaseService().(*KeybaseDaemonLocal)
	if !ok {
		return errors.New("Bad keybase daemon")
	}

	return kbd.addTeamReaderForTest(tid, uid)
}

// AddTeamReaderForTestOrBust is like AddTeamWriterForTest, but
// dies if there's an error.
func AddTeamReaderForTestOrBust(t logger.TestLogBackend, config Config,
	tid keybase1.TeamID, uid keybase1.UID) {
	err := AddTeamReaderForTest(config, tid, uid)
	if err != nil {
		t.Fatal(err)
	}
}

// AddTeamKeyForTest adds a new key for the given team.
func AddTeamKeyForTest(config Config, tid keybase1.TeamID) error {
	kbd, ok := config.KeybaseService().(*KeybaseDaemonLocal)
	if !ok {
		return errors.New("Bad keybase daemon")
	}

	ti, err := kbd.LoadTeamPlusKeys(
		context.Background(), tid, tlf.Unknown, kbfsmd.UnspecifiedKeyGen,
		keybase1.UserVersion{}, kbfscrypto.VerifyingKey{},
		keybase1.TeamRole_NONE)
	if err != nil {
		return err
	}
	newKeyGen := ti.LatestKeyGen + 1
	newKey := MakeLocalTLFCryptKeyOrBust(
		buildCanonicalPathForTlfType(tlf.SingleTeam, string(ti.Name)),
		newKeyGen)
	return kbd.addTeamKeyForTest(tid, newKeyGen, newKey)
}

// AddTeamKeyForTestOrBust is like AddTeamKeyForTest, but
// dies if there's an error.
func AddTeamKeyForTestOrBust(t logger.TestLogBackend, config Config,
	tid keybase1.TeamID) {
	err := AddTeamKeyForTest(config, tid)
	if err != nil {
		t.Fatal(err)
	}
}

// AddEmptyTeamsForTest creates teams for the given names with empty
// membership lists.
func AddEmptyTeamsForTest(
	config Config, teams ...kbname.NormalizedUsername) ([]TeamInfo, error) {
	teamInfos := MakeLocalTeams(teams)

	kbd, ok := config.KeybaseService().(*KeybaseDaemonLocal)
	if !ok {
		return nil, errors.New("Bad keybase daemon")
	}

	kbd.addTeamsForTest(teamInfos)
	return teamInfos, nil
}

// AddEmptyTeamsForTestOrBust is like AddEmptyTeamsForTest, but dies
// if there's an error.
func AddEmptyTeamsForTestOrBust(t logger.TestLogBackend,
	config Config, teams ...kbname.NormalizedUsername) []TeamInfo {
	teamInfos, err := AddEmptyTeamsForTest(config, teams...)
	if err != nil {
		t.Fatal(err)
	}
	return teamInfos
}

// AddImplicitTeamForTest adds an implicit team with a TLF ID.
func AddImplicitTeamForTest(
	config Config, name, suffix string, teamNumber byte, ty tlf.Type) (
	keybase1.TeamID, error) {
	iteamInfo, err := config.KeybaseService().ResolveIdentifyImplicitTeam(
		context.Background(), name, suffix, ty, true, "")
	if err != nil {
		return "", err
	}
	return iteamInfo.TID, nil
}

// AddImplicitTeamForTestOrBust is like AddImplicitTeamForTest, but
// dies if there's an error.
func AddImplicitTeamForTestOrBust(t logger.TestLogBackend,
	config Config, name, suffix string, teamNumber byte,
	ty tlf.Type) keybase1.TeamID {
	teamID, err := AddImplicitTeamForTest(config, name, suffix, teamNumber, ty)
	if err != nil {
		t.Fatal(err)
	}
	return teamID
}

// ChangeTeamNameForTest renames a team.
func ChangeTeamNameForTest(
	config Config, oldName, newName string) error {
	kbd, ok := config.KeybaseService().(*KeybaseDaemonLocal)
	if !ok {
		return errors.New("Bad keybase daemon")
	}

	tid, err := kbd.changeTeamNameForTest(oldName, newName)
	if err != nil {
		return err
	}

	config.KBFSOps().TeamNameChanged(context.Background(), tid)
	return nil
}

// ChangeTeamNameForTestOrBust is like ChangeTeamNameForTest, but dies
// if there's an error.
func ChangeTeamNameForTestOrBust(t logger.TestLogBackend, config Config,
	oldName, newName string) {
	err := ChangeTeamNameForTest(config, oldName, newName)
	if err != nil {
		t.Fatal(err)
	}
}

// SetGlobalMerkleRootForTest sets the global Merkle root and time.
func SetGlobalMerkleRootForTest(
	config Config, root keybase1.MerkleRootV2, rootTime time.Time) error {
	kbd, ok := config.KeybaseService().(*KeybaseDaemonLocal)
	if !ok {
		return errors.New("Bad keybase daemon")
	}

	kbd.setCurrentMerkleRoot(root, rootTime)
	return nil
}

// SetGlobalMerkleRootForTestOrBust is like
// SetGlobalMerkleRootForTest, but dies if there's an error.
func SetGlobalMerkleRootForTestOrBust(
	t logger.TestLogBackend, config Config, root keybase1.MerkleRootV2,
	rootTime time.Time) {
	err := SetGlobalMerkleRootForTest(config, root, rootTime)
	if err != nil {
		t.Fatal(err)
	}
}

// SetKbfsMerkleRootForTest sets a Merkle root for the given KBFS tree ID.
func SetKbfsMerkleRootForTest(
	config Config, treeID keybase1.MerkleTreeID,
	root *kbfsmd.MerkleRoot) error {
	md, ok := config.MDServer().(mdServerLocal)
	if !ok {
		return errors.New("Bad md server")
	}
	md.setKbfsMerkleRoot(treeID, root)
	return nil
}

// SetKbfsMerkleRootForTestOrBust is like SetKbfsMerkleRootForTest,
// but dies if there's an error.
func SetKbfsMerkleRootForTestOrBust(
	t logger.TestLogBackend, config Config, treeID keybase1.MerkleTreeID,
	root *kbfsmd.MerkleRoot) {
	err := SetKbfsMerkleRootForTest(config, treeID, root)
	if err != nil {
		t.Fatal(err)
	}
}

// EnableImplicitTeamsForTest causes the mdserver to stop returning
// random TLF IDs for new TLFs.
func EnableImplicitTeamsForTest(config Config) error {
	md, ok := config.MDServer().(mdServerLocal)
	if !ok {
		return errors.New("Bad md server")
	}
	md.enableImplicitTeams()
	return nil
}

func testRPCWithCanceledContext(t logger.TestLogBackend,
	serverConn net.Conn, fn func(context.Context) error) {
	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		// Wait for RPC in fn to make progress.
		n, err := serverConn.Read([]byte{1})
		assert.Equal(t, n, 1)
		assert.NoError(t, err)
		cancel()
	}()

	err := fn(ctx)
	if errors.Cause(err) != context.Canceled {
		t.Fatalf("Function did not return a canceled error: %+v", err)
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

	ops := kbfsOps.getOpsNoAdd(context.TODO(), folderBranch)
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

	ops := kbfsOps.getOpsNoAdd(context.TODO(), folderBranch)
	ops.cr.Pause()
	return nil
}

// RestartCRForTesting re-enables conflict resolution for the given
// folder.  baseCtx must have a cancellation delayer.
func RestartCRForTesting(baseCtx context.Context, config Config,
	folderBranch FolderBranch) error {
	kbfsOps, ok := config.KBFSOps().(*KBFSOpsStandard)
	if !ok {
		return errors.New("Unexpected KBFSOps type")
	}

	ops := kbfsOps.getOpsNoAdd(baseCtx, folderBranch)
	ops.cr.Restart(baseCtx)

	// Start a resolution for anything we've missed.
	lState := makeFBOLockState()
	if ops.isUnmerged(lState) {
		ops.cr.Resolve(baseCtx, ops.getCurrMDRevision(lState),
			kbfsmd.RevisionUninitialized)
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

	ops := kbfsOps.getOpsNoAdd(context.TODO(), folderBranch)
	ops.fbm.forceQuotaReclamation()
	return nil
}

// TestClock returns a set time as the current time.
type TestClock struct {
	l sync.Mutex
	t time.Time
}

func newTestClockNow() *TestClock {
	return &TestClock{t: time.Now()}
}

func newTestClockAndTimeNow() (*TestClock, time.Time) {
	t0 := time.Now()
	return &TestClock{t: t0}, t0
}

// Now implements the Clock interface for TestClock.
func (tc *TestClock) Now() time.Time {
	tc.l.Lock()
	defer tc.l.Unlock()
	return tc.t
}

// Set sets the test clock time.
func (tc *TestClock) Set(t time.Time) {
	tc.l.Lock()
	defer tc.l.Unlock()
	tc.t = t
}

// Add adds to the test clock time.
func (tc *TestClock) Add(d time.Duration) {
	tc.l.Lock()
	defer tc.l.Unlock()
	tc.t = tc.t.Add(d)
}

// CheckConfigAndShutdown shuts down the given config, but fails the
// test if there's an error.
func CheckConfigAndShutdown(
	ctx context.Context, t logger.TestLogBackend, config Config) {
	if err := config.Shutdown(ctx); err != nil {
		t.Errorf("err=%+v", err)
	}
}

// GetRootNodeForTest gets the root node for the given TLF name, which
// must be canonical, creating it if necessary.
func GetRootNodeForTest(
	ctx context.Context, config Config, name string,
	t tlf.Type) (Node, error) {
	h, err := ParseTlfHandle(ctx, config.KBPKI(), config.MDOps(), name, t)
	if err != nil {
		return nil, err
	}

	n, _, err := config.KBFSOps().GetOrCreateRootNode(ctx, h, MasterBranch)
	if err != nil {
		return nil, err
	}

	return n, nil
}

// GetRootNodeOrBust gets the root node for the given TLF name, which
// must be canonical, creating it if necessary, and failing if there's
// an error.
func GetRootNodeOrBust(
	ctx context.Context, t logger.TestLogBackend,
	config Config, name string, ty tlf.Type) Node {
	n, err := GetRootNodeForTest(ctx, config, name, ty)
	if err != nil {
		t.Fatalf("Couldn't get root node for %s (type=%s): %+v",
			name, ty, err)
	}
	return n
}
