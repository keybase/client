// Copyright 2026 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"errors"
	"net"
	"testing"

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

// initTestContext is the minimal Context doInit needs up to the point where
// initOrderCn fails it.
type initTestContext struct {
	env.EmptyAppStateUpdater
	env     *libkb.Env
	dataDir string
}

var _ Context = (*initTestContext)(nil)

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

type shutdownRecorder struct {
	KeybaseService
	shutdown chan struct{}
}

func (s shutdownRecorder) Shutdown() {
	close(s.shutdown)
	s.KeybaseService.Shutdown()
}

var errInitTestCrypto = errors.New("crypto unavailable in test")

// initOrderCn stands in for the service. NewChat runs right after init sets
// the service, so it delivers what the live service can send at that point
// while the rest of init is still to come. NewCrypto then fails init.
type initOrderCn struct {
	t        *testing.T
	daemon   *KeybaseDaemonRPC
	shutdown chan struct{}
}

func (c *initOrderCn) NewKeybaseService(
	config Config, _ InitParams, _ Context, log logger.Logger,
) (KeybaseService, error) {
	name := kbname.NormalizedUsername("fake username")
	c.daemon = newKeybaseDaemonRPC(config, nil, log)
	c.daemon.fillClients(&fakeKeybaseClient{session: idutil.SessionInfo{
		Name:           name,
		UID:            keybase1.MakeTestUID(1),
		CryptPublicKey: idutil.MakeLocalUserCryptPublicKeyOrBust(name),
		VerifyingKey:   idutil.MakeLocalUserVerifyingKeyOrBust(name),
	}})
	return shutdownRecorder{c.daemon, c.shutdown}, nil
}

func (c *initOrderCn) NewChat(
	config Config, _ InitParams, _ Context, _ logger.Logger,
) (Chat, error) {
	ctx := context.Background()
	require.NoError(c.t, c.daemon.ReachabilityChanged(
		ctx, keybase1.Reachability{Reachable: keybase1.Reachable_NO}))
	require.NoError(c.t, c.daemon.FavoritesChanged(ctx, keybase1.UID("")))
	_, err := c.daemon.CurrentSession(ctx, 0)
	require.NoError(c.t, err)
	require.NoError(c.t, c.daemon.LoggedOut(ctx))
	return newChatLocal(config), nil
}

func (c *initOrderCn) NewCrypto(
	Config, InitParams, Context, logger.Logger,
) (Crypto, error) {
	return nil, errInitTestCrypto
}

// The service can call KBFS's handlers as soon as its connection is up, which
// is before init finishes. KBFSOps and MDOps must already be set by then, and
// a failed init must shut the connection down.
func TestInitSetsUpKBFSBeforeService(t *testing.T) {
	dataDir := t.TempDir()
	kbCtx := &initTestContext{
		env: libkb.NewEnv(nil, nil, func() logger.Logger {
			return logger.NewNull()
		}),
		dataDir: dataDir,
	}
	params := DefaultInitParams(kbCtx)
	params.StorageRoot = dataDir
	params.DiskCacheMode = DiskCacheModeOff
	params.EnableJournal = false

	cn := &initOrderCn{t: t, shutdown: make(chan struct{})}
	_, err := doInit(
		context.Background(), kbCtx, params, cn, logger.NewTestLogger(t), "test")
	require.ErrorContains(t, err, errInitTestCrypto.Error())

	select {
	case <-cn.shutdown:
	default:
		t.Fatal("init failed without shutting down the service connection")
	}
}
