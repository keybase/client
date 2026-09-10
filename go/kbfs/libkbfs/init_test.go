// Copyright 2026 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"errors"
	"net"
	"testing"
	"time"

	"github.com/keybase/client/go/kbconst"
	"github.com/keybase/client/go/kbfs/env"
	"github.com/keybase/client/go/kbfs/idutil"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/stretchr/testify/require"
)

// initTestContext is the minimal Context doInit and NewKeybaseDaemonRPC need
// in tests. It has no sockets, so connections just keep failing to dial.
type initTestContext struct {
	env.EmptyAppStateUpdater
	env     *libkb.Env
	dataDir string
}

var _ Context = (*initTestContext)(nil)

func newInitTestContext(t *testing.T) *initTestContext {
	return &initTestContext{
		env: libkb.NewEnv(nil, nil, func() logger.Logger {
			return logger.NewNull()
		}),
		dataDir: t.TempDir(),
	}
}

var errNoSocket = errors.New("no socket in test")

func (c *initTestContext) GetRunMode() kbconst.RunMode { return kbconst.DevelRunMode }
func (c *initTestContext) GetLogDir() string           { return c.dataDir }
func (c *initTestContext) GetDataDir() string          { return c.dataDir }
func (c *initTestContext) GetEnv() *libkb.Env          { return c.env }

func (c *initTestContext) GetMountDir() (string, error) {
	return "", errors.New("no mount dir in test")
}

func (c *initTestContext) ConfigureSocketInfo() error { return nil }
func (c *initTestContext) CheckService() error        { return nil }

func (c *initTestContext) GetSocket(bool) (net.Conn, rpc.Transporter, bool, error) {
	return nil, nil, false, errNoSocket
}

func (c *initTestContext) NewRPCLogFactory() rpc.LogFactory { return nil }

func (c *initTestContext) NewNetworkInstrumenter(
	keybase1.NetworkSource,
) rpc.NetworkInstrumenterStorage {
	return nil
}

func (c *initTestContext) GetKBFSSocket(bool) (net.Conn, rpc.Transporter, bool, error) {
	return nil, nil, false, errNoSocket
}

func (c *initTestContext) BindToKBFSSocket() (net.Listener, error) {
	return nil, errNoSocket
}

func (c *initTestContext) GetVDebugSetting() string  { return "" }
func (c *initTestContext) GetPerfLog() logger.Logger { return logger.NewNull() }

// newGatedTestProtocol returns a one-method protocol, standing in for
// SimpleFS/git/fs, that counts the calls that reach its handler.
func newGatedTestProtocol(calls *int) rpc.Protocol {
	return rpc.Protocol{
		Name: "gatedTest",
		Methods: map[string]rpc.ServeHandlerDescription{
			"method": {Handler: func(context.Context, any) (any, error) {
				*calls++
				return nil, nil
			}},
		},
	}
}

var errInitTestCrypto = errors.New("crypto unavailable in test")

// initOrderCn stands in for the service. Both while its connection is being
// built and once init has set it, it calls into KBFS the way the live service
// can while init is still running. NewCrypto then fails init.
type initOrderCn struct {
	t      *testing.T
	config Config
	daemon *KeybaseDaemonRPC
	gated  func(context.Context, any) (any, error)
	calls  int
}

func (c *initOrderCn) NewKeybaseService(
	config Config, _ InitParams, _ Context, log logger.Logger,
) (KeybaseService, error) {
	c.config = config
	name := kbname.NormalizedUsername("fake username")
	c.daemon = newKeybaseDaemonRPC(config, nil, log)
	c.daemon.fillClients(&fakeKeybaseClient{session: idutil.SessionInfo{
		Name:           name,
		UID:            keybase1.MakeTestUID(1),
		CryptPublicKey: idutil.MakeLocalUserCryptPublicKeyOrBust(name),
		VerifyingKey:   idutil.MakeLocalUserVerifyingKeyOrBust(name),
	}})
	gated := gateOnKBFSReady(config, []rpc.Protocol{newGatedTestProtocol(&c.calls)})
	c.gated = gated[0].Methods["method"].Handler
	c.callIntoKBFS()
	return c.daemon, nil
}

func (c *initOrderCn) NewChat(
	config Config, _ InitParams, _ Context, _ logger.Logger,
) (Chat, error) {
	c.callIntoKBFS()
	return newChatLocal(config), nil
}

func (c *initOrderCn) NewCrypto(
	Config, InitParams, Context, logger.Logger,
) (Crypto, error) {
	return nil, errInitTestCrypto
}

func (c *initOrderCn) callIntoKBFS() {
	t := c.t
	ctx := context.Background()
	for _, r := range []keybase1.Reachable{
		keybase1.Reachable_YES, keybase1.Reachable_NO,
	} {
		require.NoError(t, c.daemon.ReachabilityChanged(
			ctx, keybase1.Reachability{Reachable: r}))
	}
	require.NoError(t, c.daemon.FavoritesChanged(ctx, keybase1.UID("")))
	require.NoError(t, c.daemon.TeamChangedByID(ctx, keybase1.TeamChangedByIDArg{
		Changes: keybase1.TeamChangeSet{Renamed: true},
	}))
	require.NoError(t, c.daemon.TeamAbandoned(ctx, keybase1.TeamID("")))
	session, err := c.daemon.CurrentSession(ctx, 0)
	require.NoError(t, err)
	require.NoError(t, c.daemon.PaperKeyCached(
		ctx, keybase1.PaperKeyCachedArg{Uid: session.UID}))
	require.NoError(t, c.daemon.LoggedOut(ctx))

	// Until init is ready, requests get an error or wait.
	_, err = c.daemon.GetTLFCryptKeys(ctx, keybase1.TLFQuery{TlfName: "testuser"})
	require.Equal(t, errKBFSNotInitialized{}, err)
	waitCtx, cancel := context.WithTimeout(ctx, 20*time.Millisecond)
	defer cancel()
	_, err = c.gated(waitCtx, nil)
	require.ErrorIs(t, err, context.DeadlineExceeded)
}

// The service can call into KBFS as soon as its connection is up, which is
// before init finishes. KBFSOps and MDOps must already be set by then, and
// once init fails, requests must fail instead of waiting.
func TestInitSetsUpKBFSBeforeService(t *testing.T) {
	cn := &initOrderCn{t: t}
	kbCtx := newInitTestContext(t)
	initReturned := false
	// Registered after TempDir, so it runs first and closes the favorites
	// db before the directory is removed. Skipped if doInit stopped partway
	// (a failed assertion), since the favorites Shutdown can then block.
	t.Cleanup(func() {
		if !initReturned {
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		require.NoError(t, cn.config.KBFSOps().Shutdown(ctx))
	})
	params := DefaultInitParams(kbCtx)
	params.StorageRoot = kbCtx.dataDir
	params.DiskCacheMode = DiskCacheModeOff
	params.EnableJournal = false

	_, err := doInit(
		context.Background(), kbCtx, params, cn, logger.NewTestLogger(t), "test")
	initReturned = true
	require.ErrorContains(t, err, errInitTestCrypto.Error())

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = cn.gated(ctx, nil)
	require.Equal(t, errKBFSNotInitialized{}, err)
	_, err = cn.daemon.GetTLFCryptKeys(ctx, keybase1.TLFQuery{TlfName: "testuser"})
	require.Equal(t, errKBFSNotInitialized{}, err)
	require.Zero(t, cn.calls)
}
