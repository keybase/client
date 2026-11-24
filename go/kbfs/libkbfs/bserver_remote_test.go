// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/auth"
	"github.com/keybase/client/go/kbfs/env"

	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/stretchr/testify/require"
)

type fakeBlockEntry struct {
	folder   string
	buf      []byte
	blockKey string
	refs     map[keybase1.BlockRefNonce]keybase1.BlockReference
}

type fakeBServerClient struct {
	keybase1.BlockInterface
	entries map[keybase1.BlockIdCombo]fakeBlockEntry
}

func (fc *fakeBServerClient) PutBlock(
	ctx context.Context, arg keybase1.PutBlockArg,
) error {
	var refs map[keybase1.BlockRefNonce]keybase1.BlockReference
	if e, ok := fc.entries[arg.Bid]; ok {
		refs = e.refs
	} else {
		refs = make(map[keybase1.BlockRefNonce]keybase1.BlockReference)
		fc.entries[arg.Bid] = fakeBlockEntry{
			arg.Folder, arg.Buf, arg.BlockKey, refs,
		}
	}
	refs[keybase1.BlockRefNonce{}] = keybase1.BlockReference{
		Bid: arg.Bid,
	}
	return nil
}

func (fc *fakeBServerClient) GetBlock(ctx context.Context, arg keybase1.GetBlockArg) (keybase1.GetBlockRes, error) {
	e, ok := fc.entries[arg.Bid]
	if !ok {
		return keybase1.GetBlockRes{}, kbfsblock.ServerErrorBlockNonExistent{}
	}
	return keybase1.GetBlockRes{
		Buf:      e.buf,
		BlockKey: e.blockKey,
	}, nil
}

func (fc *fakeBServerClient) AddReference(ctx context.Context, arg keybase1.AddReferenceArg) error {
	e, ok := fc.entries[arg.Ref.Bid]
	if !ok {
		return kbfsblock.ServerErrorBlockNonExistent{}
	}
	e.refs[arg.Ref.Nonce] = arg.Ref
	return nil
}

type testBlockServerRemoteConfig struct {
	codecGetter
	logMaker
	signer         kbfscrypto.Signer
	sessionGetter  idutil.CurrentSessionGetter
	diskBlockCache DiskBlockCache
}

var _ blockServerRemoteConfig = (*testBlockServerRemoteConfig)(nil)

func (c testBlockServerRemoteConfig) Signer() kbfscrypto.Signer {
	return c.signer
}

func (c testBlockServerRemoteConfig) CurrentSessionGetter() idutil.CurrentSessionGetter {
	return c.sessionGetter
}

func (c testBlockServerRemoteConfig) DiskBlockCache() DiskBlockCache {
	return c.diskBlockCache
}

func (c testBlockServerRemoteConfig) Mode() InitMode {
	return modeTest{}
}

func (c testBlockServerRemoteConfig) IsTestMode() bool {
	return true
}

// Test that putting a block, and getting it back, works
func TestBServerRemotePutAndGet(t *testing.T) {
	currentUID := keybase1.MakeTestUID(1)
	fc := fakeBServerClient{
		entries: make(map[keybase1.BlockIdCombo]fakeBlockEntry),
	}
	config := testBlockServerRemoteConfig{
		newTestCodecGetter(),
		newTestLogMaker(t), nil, nil, nil,
	}
	b := newBlockServerRemoteWithClient(&env.KBFSContext{}, config, &fc)

	tlfID := tlf.FakeID(2, tlf.Private)
	bCtx := kbfsblock.MakeFirstContext(
		currentUID.AsUserOrTeam(), keybase1.BlockType_DATA)
	data := []byte{1, 2, 3, 4}
	bID, err := kbfsblock.MakePermanentID(
		data, kbfscrypto.EncryptionSecretboxWithKeyNonce)
	require.NoError(t, err)

	serverHalf, err := kbfscrypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)
	ctx := context.Background()
	err = b.Put(ctx, tlfID, bID, bCtx, data, serverHalf, DiskBlockAnyCache)
	require.NoError(t, err)

	// Now get the same block back.
	buf, sh, err := b.Get(ctx, tlfID, bID, bCtx, DiskBlockAnyCache)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, sh)

	// Add a reference.
	nonce, err := kbfsblock.MakeRefNonce()
	require.NoError(t, err)
	bCtx2 := kbfsblock.MakeContext(
		currentUID.AsUserOrTeam(), keybase1.MakeTestUID(2).AsUserOrTeam(),
		nonce, keybase1.BlockType_DATA)
	err = b.AddBlockReference(ctx, tlfID, bID, bCtx2)
	require.NoError(t, err)

	// Now get the same block back.
	buf, sh, err = b.Get(ctx, tlfID, bID, bCtx2, DiskBlockAnyCache)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, sh)
}

// If we cancel the RPC before the RPC returns, the call should error quickly.
func TestBServerRemotePutCanceled(t *testing.T) {
	currentUID := keybase1.MakeTestUID(1)
	serverConn, conn := rpc.MakeConnectionForTest(t)
	config := testBlockServerRemoteConfig{
		newTestCodecGetter(),
		newTestLogMaker(t), nil, nil, nil,
	}
	b := newBlockServerRemoteWithClient(&env.KBFSContext{}, config,
		keybase1.BlockClient{Cli: conn.GetClient()})

	f := func(ctx context.Context) error {
		bID := kbfsblock.FakeID(1)
		tlfID := tlf.FakeID(2, tlf.Private)
		bCtx := kbfsblock.MakeFirstContext(
			currentUID.AsUserOrTeam(), keybase1.BlockType_DATA)
		data := []byte{1, 2, 3, 4}
		serverHalf := kbfscrypto.MakeBlockCryptKeyServerHalf(
			[32]byte{0x1})
		return b.Put(ctx, tlfID, bID, bCtx, data, serverHalf, DiskBlockAnyCache)
	}
	testRPCWithCanceledContext(t, serverConn, f)
}

type staleRefreshKeyType struct{}

// staleRefreshKey marks the context of the refresh that read the
// previous user's session.
var staleRefreshKey staleRefreshKeyType

func isStaleRefresh(ctx context.Context) bool {
	return ctx.Value(staleRefreshKey) != nil
}

// authBServerClient stands in for the block server's session auth at
// the RPC edge, checking tokens with auth.VerifyToken. It keeps one
// challenge per connection, which any authentication attempt consumes:
// in the KBFS log of two logins landing together, the second refresh
// got "Challenge not set" right after the first one's refused attempt.
// Its gates replay that interleaving: the stale refresh's challenge
// request blocks until `release`, and any other authentication waits
// until the stale one has tried. With refreshes serialized, the gates
// are already satisfied and impose no extra order.
type authBServerClient struct {
	keybase1.BlockInterface

	release         chan struct{}
	staleChallenged chan struct{}
	newChallenged   chan struct{}
	staleAuthed     chan struct{}
	closeOnce       sync.Map // gate -> *sync.Once

	lock      sync.Mutex
	challenge string
	authedUID keybase1.UID
}

func newAuthBServerClient() *authBServerClient {
	return &authBServerClient{
		release:         make(chan struct{}),
		staleChallenged: make(chan struct{}),
		newChallenged:   make(chan struct{}),
		staleAuthed:     make(chan struct{}),
	}
}

// gateTimeout bounds every wait on a gate, so a refresh that never
// reaches the server fails the test instead of hanging it.
const gateTimeout = 10 * time.Second

func waitGate(ctx context.Context, gate chan struct{}) error {
	select {
	case <-gate:
		return nil
	case <-time.After(gateTimeout):
		return errors.New("timed out at a test gate")
	case <-ctx.Done():
		return ctx.Err()
	}
}

// open opens a gate; later calls are no-ops, so an extra request fails
// the test's assertion instead of panicking.
func (c *authBServerClient) open(gate chan struct{}) {
	once, _ := c.closeOnce.LoadOrStore(gate, &sync.Once{})
	once.(*sync.Once).Do(func() { close(gate) })
}

func (c *authBServerClient) GetSessionChallenge(
	ctx context.Context,
) (keybase1.ChallengeInfo, error) {
	challenge, err := auth.GenerateChallenge()
	if err != nil {
		return keybase1.ChallengeInfo{}, err
	}
	c.lock.Lock()
	c.challenge = challenge
	c.lock.Unlock()
	if isStaleRefresh(ctx) {
		c.open(c.staleChallenged)
		if err := waitGate(ctx, c.release); err != nil {
			return keybase1.ChallengeInfo{}, err
		}
	} else {
		c.open(c.newChallenged)
	}
	return keybase1.ChallengeInfo{
		Now: time.Now().Unix(), Challenge: challenge,
	}, nil
}

func (c *authBServerClient) AuthenticateSession(
	ctx context.Context, signature string,
) error {
	if isStaleRefresh(ctx) {
		defer c.open(c.staleAuthed)
	} else if err := waitGate(ctx, c.staleAuthed); err != nil {
		return err
	}
	c.lock.Lock()
	defer c.lock.Unlock()
	challenge := c.challenge
	c.challenge = ""
	if challenge == "" {
		return kbfsblock.ServerErrorUnauthorized{Msg: "Challenge not set"}
	}
	token, err := auth.VerifyToken(signature, kbfsblock.ServerTokenServer,
		challenge, kbfsblock.ServerTokenExpireIn)
	if err != nil {
		return kbfsblock.ServerErrorUnauthorized{Msg: err.Error()}
	}
	c.authedUID = token.UID()
	return nil
}

func (c *authBServerClient) authed() keybase1.UID {
	c.lock.Lock()
	defer c.lock.Unlock()
	return c.authedUID
}

func requireClosedSoon(t *testing.T, ch chan struct{}, what string) {
	t.Helper()
	select {
	case <-ch:
	case <-time.After(gateTimeout):
		t.Fatalf("timed out waiting for %s", what)
	}
}

// Two logins landing together start two auth refreshes. The first
// reads the previous user's session, while the service already signs
// with the new user's device, so its token is refused. While it waits
// on the server, the session switches to the new user and a second
// refresh starts. The new user must end up authenticated.
func TestBServerRemoteRefreshAcrossLogins(t *testing.T) {
	config := MakeTestConfigOrBust(t, "testuser", "testuser-mac")
	defer func() { _ = config.Shutdown(context.Background()) }()
	daemon := config.KeybaseService().(*KeybaseDaemonLocal)
	newUID := keybase1.MakeTestUID(2)

	server := newAuthBServerClient()
	log := config.MakeLogger("BSR")
	b := &blockServerRemoteClientHandler{
		name:     "BlockServerRemoteTest",
		log:      log,
		deferLog: log,
		csg:      config.KBPKI(),
		client:   server,
	}
	b.authToken = kbfscrypto.NewAuthToken(
		kbfscrypto.SigningKeySigner{
			Key: idutil.MakeLocalUserSigningKeyOrBust("testuser-mac"),
		},
		kbfsblock.ServerTokenServer, kbfsblock.ServerTokenExpireIn,
		"libkbfs_bserver_remote_test", VersionString(), b)
	defer b.authToken.Shutdown()

	staleDone := make(chan struct{})
	go func() {
		defer close(staleDone)
		b.RefreshAuthToken(context.WithValue(
			context.Background(), staleRefreshKey, true))
	}()
	requireClosedSoon(t, server.staleChallenged, "the stale challenge")

	daemon.SetCurrentUID(newUID)
	newDone := make(chan struct{})
	go func() {
		defer close(newDone)
		b.RefreshAuthToken(context.Background())
	}()
	// Let the stale refresh go on once the new one has either queued
	// behind it or asked for its own challenge, replacing the stale
	// one's.
	deadline := time.After(gateTimeout)
	for queued := false; !queued; {
		select {
		case <-server.newChallenged:
			queued = true
		case <-deadline:
			t.Fatal("the new refresh never queued or asked for a challenge")
		case <-time.After(time.Millisecond):
			queued = b.refresher.waiting.Load() > 0
		}
	}
	close(server.release)
	requireClosedSoon(t, staleDone, "the stale refresh")
	requireClosedSoon(t, newDone, "the new refresh")
	require.Equal(t, newUID, server.authed())
}
