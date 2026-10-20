package service

import (
	"context"
	"fmt"
	"net"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/stretchr/testify/require"
)

type shutdownOnConnectSyncer struct {
	types.Syncer
	onConnected func(ctx context.Context)
}

func (s *shutdownOnConnectSyncer) Connected(ctx context.Context, cli chat1.RemoteInterface, uid gregor1.UID,
	syncRes *chat1.SyncChatRes,
) error {
	s.onConnected(ctx)
	return nil
}

func (s *shutdownOnConnectSyncer) Disconnected(ctx context.Context) {}

type nopConnectionTransport struct{}

func (nopConnectionTransport) Dial(ctx context.Context) (rpc.Transporter, error) {
	return nil, fmt.Errorf("dial not supported")
}
func (nopConnectionTransport) IsConnected() bool { return false }
func (nopConnectionTransport) Finalize()         {}
func (nopConnectionTransport) Close()            {}

type syncAllOnlyClient struct {
	res chat1.SyncAllResult
}

func (c syncAllOnlyClient) Call(ctx context.Context, method string, arg any, res any, timeout time.Duration) error {
	return fmt.Errorf("unexpected call: %s", method)
}

func (c syncAllOnlyClient) CallCompressed(ctx context.Context, method string, arg any, res any,
	ctype rpc.CompressionType, timeout time.Duration,
) error {
	if method != "chat.1.remote.syncAll" {
		return fmt.Errorf("unexpected call: %s", method)
	}
	*res.(*chat1.SyncAllResult) = c.res
	return nil
}

func (c syncAllOnlyClient) Notify(ctx context.Context, method string, arg any, timeout time.Duration) error {
	return fmt.Errorf("unexpected notify: %s", method)
}

func TestGregorShutdownDuringOnConnectClearsConnectedAt(t *testing.T) {
	tc, g := setupGregorTest(t)
	defer tc.Cleanup()

	uid := libkb.UsernameToUID("testuser")
	sigKey, err := libkb.GenerateNaclSigningKeyPair()
	require.NoError(t, err)
	deviceID, err := libkb.NewDeviceID()
	require.NoError(t, err)
	err = tc.G.ActiveDevice.Set(libkb.NewMetaContextForTest(tc), keybase1.UserVersion{Uid: uid, EldestSeqno: 1},
		deviceID, sigKey, nil, "testdevice", keybase1.ToTime(time.Now()), libkb.KeychainModeNone)
	require.NoError(t, err)

	h := newGregorHandler(g)
	h.uri, err = rpc.ParseFMPURI("fmprpc://localhost:9911")
	require.NoError(t, err)
	h.shutdownCh = make(chan struct{})
	h.conn = rpc.NewConnectionWithTransport(h, nopConnectionTransport{}, libkb.NewContextifiedErrorUnwrapper(tc.G),
		logger.LogOutputWithDepthAdder{Logger: tc.G.Log}, rpc.ConnectionOpts{DontConnectNow: true})

	// Syncer.Connected runs after OnConnect has authenticated, so a Shutdown here
	// models logout landing while OnConnect is still syncing.
	g.Syncer = &shutdownOnConnectSyncer{
		onConnected: func(ctx context.Context) { h.Shutdown(ctx) },
	}

	cli := syncAllOnlyClient{res: chat1.SyncAllResult{
		Auth:         gregor1.AuthResult{Uid: uid.ToBytes()},
		Notification: chat1.NewSyncAllNotificationResWithState(gregor1.State{}),
	}}
	srvConn, cliConn := net.Pipe()
	defer srvConn.Close()
	defer cliConn.Close()
	srv := rpc.NewServer(rpc.NewTransport(srvConn, nil, nil, nil, rpc.DefaultMaxFrameLength), nil)

	done := make(chan error, 1)
	go func() { done <- h.OnConnect(context.TODO(), h.conn, cli, srv) }()
	select {
	case err := <-done:
		require.NoError(t, err)
	case <-time.After(20 * time.Second):
		require.Fail(t, "OnConnect did not return")
	}

	require.True(t, h.IsShutdown())
	require.True(t, h.connectedSince().IsZero(), "connectedAt must stay zero after Shutdown ran during OnConnect")
}
