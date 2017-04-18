// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"os"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

// KeybaseDaemonRPC implements the KeybaseService interface using RPC
// calls.
type KeybaseDaemonRPC struct {
	*KeybaseServiceBase
	daemonLog logger.Logger

	// Only used when there's a real connection (i.e., not in
	// testing).
	shutdownFn func()

	keepAliveCancel context.CancelFunc

	// protocols (additional to required protocols) to register on server connect
	protocols []rpc.Protocol

	// simplefs is the simplefs implementation used (if not nil)
	simplefs keybase1.SimpleFSInterface
}

var _ keybase1.NotifySessionInterface = (*KeybaseDaemonRPC)(nil)

var _ keybase1.NotifyKeyfamilyInterface = (*KeybaseDaemonRPC)(nil)

var _ keybase1.NotifyPaperKeyInterface = (*KeybaseDaemonRPC)(nil)

var _ rpc.ConnectionHandler = (*KeybaseDaemonRPC)(nil)

var _ KeybaseService = (*KeybaseDaemonRPC)(nil)

// NewKeybaseDaemonRPC makes a new KeybaseDaemonRPC that makes RPC
// calls using the socket of the given Keybase context.
func NewKeybaseDaemonRPC(config Config, kbCtx Context, log logger.Logger,
	debug bool, createSimpleFS func(Config) keybase1.SimpleFSInterface,
) *KeybaseDaemonRPC {
	k := newKeybaseDaemonRPC(config, kbCtx, log)
	k.config = config
	k.daemonLog = logger.NewWithCallDepth("daemon", 1)
	if createSimpleFS != nil {
		k.simplefs = createSimpleFS(config)
	}
	if debug {
		k.daemonLog.Configure("", true, "")
	}
	conn := NewSharedKeybaseConnection(kbCtx, config, k)
	k.fillClients(conn.GetClient())
	k.shutdownFn = conn.Shutdown

	ctx, cancel := context.WithCancel(context.Background())
	k.keepAliveCancel = cancel
	go k.keepAliveLoop(ctx)

	return k
}

// For testing.
func newKeybaseDaemonRPCWithClient(kbCtx Context, client rpc.GenericClient,
	log logger.Logger) *KeybaseDaemonRPC {
	k := newKeybaseDaemonRPC(nil, kbCtx, log)
	k.fillClients(client)
	// No need for a keepalive loop in this case, since this is only
	// used during testing.
	return k
}

func newKeybaseDaemonRPC(config Config, kbCtx Context, log logger.Logger) *KeybaseDaemonRPC {
	serviceBase := NewKeybaseServiceBase(config, kbCtx, log)
	if serviceBase == nil {
		return nil
	}
	k := KeybaseDaemonRPC{
		KeybaseServiceBase: serviceBase,
	}
	return &k
}

func (k *KeybaseDaemonRPC) fillClients(client rpc.GenericClient) {
	k.FillClients(keybase1.IdentifyClient{Cli: client},
		keybase1.UserClient{Cli: client},
		keybase1.SessionClient{Cli: client},
		keybase1.FavoriteClient{Cli: client},
		keybase1.KbfsClient{Cli: client},
		keybase1.KbfsMountClient{Cli: client})
}

type daemonLogUI struct {
	log logger.Logger
}

var _ keybase1.LogUiInterface = daemonLogUI{}

func (l daemonLogUI) Log(ctx context.Context, arg keybase1.LogArg) error {
	format := "%s"
	// arg.Text.Markup should always be false, so ignore it.
	s := arg.Text.Data
	switch arg.Level {
	case keybase1.LogLevel_DEBUG:
		l.log.CDebugf(ctx, format, s)
	case keybase1.LogLevel_INFO:
		l.log.CInfof(ctx, format, s)
	case keybase1.LogLevel_WARN:
		l.log.CWarningf(ctx, format, s)
	case keybase1.LogLevel_ERROR:
		l.log.CErrorf(ctx, format, s)
	case keybase1.LogLevel_NOTICE:
		l.log.CNoticef(ctx, format, s)
	case keybase1.LogLevel_CRITICAL:
		l.log.CCriticalf(ctx, format, s)
	default:
		l.log.CWarningf(ctx, format, s)
	}
	return nil
}

type daemonIdentifyUI struct {
	log logger.Logger
}

var _ keybase1.IdentifyUiInterface = daemonIdentifyUI{}

func (d daemonIdentifyUI) DelegateIdentifyUI(ctx context.Context) (int, error) {
	d.log.CDebugf(ctx, "DelegateIdentifyUI() (returning 0, UIDelegationUnavailableError{}")
	return 0, libkb.UIDelegationUnavailableError{}
}

func (d daemonIdentifyUI) Start(ctx context.Context, arg keybase1.StartArg) error {
	d.log.CDebugf(ctx, "Start(%+v)", arg)
	return nil
}

func (d daemonIdentifyUI) DisplayKey(ctx context.Context, arg keybase1.DisplayKeyArg) error {
	d.log.CDebugf(ctx, "DisplayKey(%+v)", arg)
	return nil
}

func (d daemonIdentifyUI) ReportLastTrack(ctx context.Context, arg keybase1.ReportLastTrackArg) error {
	d.log.CDebugf(ctx, "ReportLastTrack(%+v)", arg)
	return nil
}

func (d daemonIdentifyUI) LaunchNetworkChecks(ctx context.Context, arg keybase1.LaunchNetworkChecksArg) error {
	d.log.CDebugf(ctx, "LaunchNetworkChecks(%+v)", arg)
	return nil
}

func (d daemonIdentifyUI) DisplayTrackStatement(ctx context.Context, arg keybase1.DisplayTrackStatementArg) error {
	d.log.CDebugf(ctx, "DisplayTrackStatement(%+v)", arg)
	return nil
}

func (d daemonIdentifyUI) FinishWebProofCheck(ctx context.Context, arg keybase1.FinishWebProofCheckArg) error {
	d.log.CDebugf(ctx, "FinishWebProofCheck(%+v)", arg)
	return nil
}

func (d daemonIdentifyUI) FinishSocialProofCheck(ctx context.Context, arg keybase1.FinishSocialProofCheckArg) error {
	d.log.CDebugf(ctx, "FinishSocialProofCheck(%+v)", arg)
	return nil
}

func (d daemonIdentifyUI) DisplayCryptocurrency(ctx context.Context, arg keybase1.DisplayCryptocurrencyArg) error {
	d.log.CDebugf(ctx, "DisplayCryptocurrency(%+v)", arg)
	return nil
}

func (d daemonIdentifyUI) ReportTrackToken(ctx context.Context, arg keybase1.ReportTrackTokenArg) error {
	d.log.CDebugf(ctx, "ReportTrackToken(%+v)", arg)
	return nil
}

func (d daemonIdentifyUI) DisplayUserCard(ctx context.Context, arg keybase1.DisplayUserCardArg) error {
	d.log.CDebugf(ctx, "DisplayUserCard(%+v)", arg)
	return nil
}

func (d daemonIdentifyUI) Confirm(ctx context.Context, arg keybase1.ConfirmArg) (keybase1.ConfirmResult, error) {
	d.log.CDebugf(ctx, "Confirm(%+v) (returning false)", arg)
	return keybase1.ConfirmResult{
		IdentityConfirmed: false,
		RemoteConfirmed:   false,
	}, nil
}

func (d daemonIdentifyUI) DisplayTLFCreateWithInvite(ctx context.Context,
	arg keybase1.DisplayTLFCreateWithInviteArg) (err error) {
	return nil
}

func (d daemonIdentifyUI) Dismiss(ctx context.Context,
	_ keybase1.DismissArg) error {
	return nil
}

func (d daemonIdentifyUI) Cancel(ctx context.Context, sessionID int) error {
	d.log.CDebugf(ctx, "Cancel(%d)", sessionID)
	return nil
}

func (d daemonIdentifyUI) Finish(ctx context.Context, sessionID int) error {
	d.log.CDebugf(ctx, "Finish(%d)", sessionID)
	return nil
}

// HandlerName implements the ConnectionHandler interface.
func (*KeybaseDaemonRPC) HandlerName() string {
	return "KeybaseDaemonRPC"
}

// AddProtocols adds protocols that are registered on server connect
func (k *KeybaseDaemonRPC) AddProtocols(protocols []rpc.Protocol) {
	if protocols == nil {
		return
	}
	if k.protocols != nil {
		k.protocols = append(k.protocols, protocols...)
	} else {
		k.protocols = protocols
	}
}

// OnConnect implements the ConnectionHandler interface.
func (k *KeybaseDaemonRPC) OnConnect(ctx context.Context,
	conn *rpc.Connection, rawClient rpc.GenericClient,
	server *rpc.Server) error {

	// Protocols that KBFS requires
	protocols := []rpc.Protocol{
		keybase1.LogUiProtocol(daemonLogUI{k.daemonLog}),
		keybase1.IdentifyUiProtocol(daemonIdentifyUI{k.daemonLog}),
		keybase1.NotifySessionProtocol(k),
		keybase1.NotifyKeyfamilyProtocol(k),
		keybase1.NotifyPaperKeyProtocol(k),
		keybase1.NotifyFSRequestProtocol(k),
		keybase1.TlfKeysProtocol(k),
		keybase1.ReachabilityProtocol(k),
	}

	// Add simplefs if set
	if k.simplefs != nil {
		protocols = append(protocols, keybase1.SimpleFSProtocol(k.simplefs))
	}

	if k.protocols != nil {
		protocols = append(protocols, k.protocols...)
	}

	for _, p := range protocols {
		err := server.Register(p)
		if err != nil {
			if _, ok := err.(rpc.AlreadyRegisteredError); !ok {
				return err
			}
		}
	}

	// Using conn.GetClient() here would cause problematic
	// recursion.
	c := keybase1.NotifyCtlClient{Cli: rawClient}
	err := c.SetNotifications(ctx, keybase1.NotificationChannels{
		Session:      true,
		Paperkeys:    true,
		Keyfamily:    true,
		Kbfsrequest:  true,
		Reachability: true,
	})
	if err != nil {
		return err
	}

	// Introduce ourselves. TODO: move this to SharedKeybaseConnection
	// somehow?
	configClient := keybase1.ConfigClient{Cli: rawClient}
	err = configClient.HelloIAm(ctx, keybase1.ClientDetails{
		Pid:        os.Getpid(),
		ClientType: keybase1.ClientType_KBFS,
		Argv:       os.Args,
		Version:    VersionString(),
	})
	if err != nil {
		return err
	}

	return nil
}

// OnConnectError implements the ConnectionHandler interface.
func (k *KeybaseDaemonRPC) OnConnectError(err error, wait time.Duration) {
	k.log.Warning("KeybaseDaemonRPC: connection error: %q; retrying in %s",
		err, wait)
}

// OnDoCommandError implements the ConnectionHandler interface.
func (k *KeybaseDaemonRPC) OnDoCommandError(err error, wait time.Duration) {
	k.log.Warning("KeybaseDaemonRPC: docommand error: %q; retrying in %s",
		err, wait)
}

// OnDisconnected implements the ConnectionHandler interface.
func (k *KeybaseDaemonRPC) OnDisconnected(_ context.Context,
	status rpc.DisconnectStatus) {
	if status == rpc.StartingNonFirstConnection {
		k.log.Warning("KeybaseDaemonRPC is disconnected")
	}

	k.clearCaches()
}

// ShouldRetry implements the ConnectionHandler interface.
func (k *KeybaseDaemonRPC) ShouldRetry(rpcName string, err error) bool {
	return false
}

// ShouldRetryOnConnect implements the ConnectionHandler interface.
func (k *KeybaseDaemonRPC) ShouldRetryOnConnect(err error) bool {
	_, inputCanceled := err.(libkb.InputCanceledError)
	return !inputCanceled
}

func (k *KeybaseDaemonRPC) keepAliveLoop(ctx context.Context) {
	// If the connection is dropped, we need to re-connect and send
	// another HelloIAm message. However, we can't actually detect
	// when the connection is closed until KBFS makes another outgoing
	// RPC, which might not happen for a while.  So continuously send
	// a cheap RPC in the background, so that OnConnect will get
	// called as soon as the connection comes back.
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if k.sessionClient == nil {
				// Clients haven't been filled yet.
				continue
			}
			const sessionID = 0
			err := k.sessionClient.SessionPing(ctx)
			if err != nil {
				k.log.CWarningf(
					ctx, "Background keep alive hit an error: %v", err)
			}
		}
	}
}

// Shutdown implements the KeybaseService interface for KeybaseDaemonRPC.
func (k *KeybaseDaemonRPC) Shutdown() {
	if k.shutdownFn != nil {
		k.shutdownFn()
	}
	if k.keepAliveCancel != nil {
		k.keepAliveCancel()
	}
}
