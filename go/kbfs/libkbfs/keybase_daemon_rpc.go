// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"os"
	"runtime"
	"sync"
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
	lock      sync.RWMutex
	protocols []rpc.Protocol
	// server is set in OnConnect. If this is non-nil, subsequent AddProtocol
	// calls triggers a server.Register.
	server *rpc.Server

	notifyService keybase1.NotifyServiceInterface
}

var _ keybase1.NotifySessionInterface = (*KeybaseDaemonRPC)(nil)

var _ keybase1.NotifyKeyfamilyInterface = (*KeybaseDaemonRPC)(nil)

var _ keybase1.NotifyPaperKeyInterface = (*KeybaseDaemonRPC)(nil)

var _ keybase1.NotifyFSRequestInterface = (*KeybaseDaemonRPC)(nil)

var _ keybase1.NotifyTeamInterface = (*KeybaseDaemonRPC)(nil)

var _ rpc.ConnectionHandler = (*KeybaseDaemonRPC)(nil)

var _ KeybaseService = (*KeybaseDaemonRPC)(nil)

var _ keybase1.ImplicitTeamMigrationInterface = (*KeybaseDaemonRPC)(nil)

func (k *KeybaseDaemonRPC) addKBFSProtocols() {
	// Protocols that KBFS requires
	protocols := []rpc.Protocol{
		keybase1.LogUiProtocol(daemonLogUI{k.daemonLog}),
		keybase1.IdentifyUiProtocol(daemonIdentifyUI{k.daemonLog}),
		keybase1.NotifySessionProtocol(k),
		keybase1.NotifyKeyfamilyProtocol(k),
		keybase1.NotifyPaperKeyProtocol(k),
		keybase1.NotifyFSRequestProtocol(k),
		keybase1.NotifyTeamProtocol(k),
		keybase1.NotifyFavoritesProtocol(k),
		keybase1.TlfKeysProtocol(k),
		keybase1.ReachabilityProtocol(k),
		keybase1.ImplicitTeamMigrationProtocol(k),
	}

	if k.notifyService != nil {
		k.log.Warning("adding NotifyService protocol")
		protocols = append(protocols, keybase1.NotifyServiceProtocol(k.notifyService))
	}

	k.AddProtocols(protocols)
}

// NewKeybaseDaemonRPC makes a new KeybaseDaemonRPC that makes RPC
// calls using the socket of the given Keybase context.
func NewKeybaseDaemonRPC(config Config, kbCtx Context, log logger.Logger,
	debug bool, additionalProtocols []rpc.Protocol) *KeybaseDaemonRPC {
	k := newKeybaseDaemonRPC(config, kbCtx, log)
	k.config = config
	k.daemonLog = logger.New("daemon")
	if debug {
		k.daemonLog.Configure("", true, "")
	}
	conn := NewSharedKeybaseConnection(kbCtx, config, k)
	k.fillClients(conn.GetClient())
	k.shutdownFn = conn.Shutdown

	if config.Mode().ServiceKeepaliveEnabled() {
		ctx, cancel := context.WithCancel(context.Background())
		k.keepAliveCancel = cancel
		go k.keepAliveLoop(ctx)
	}
	k.notifyService = newNotifyServiceHandler(config, log)

	k.addKBFSProtocols()
	k.AddProtocols(additionalProtocols)

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
		keybase1.TeamsClient{Cli: client},
		keybase1.MerkleClient{Cli: client},
		keybase1.SessionClient{Cli: client},
		keybase1.FavoriteClient{Cli: client},
		keybase1.KbfsClient{Cli: client},
		keybase1.KbfsMountClient{Cli: client},
		keybase1.GitClient{Cli: client},
		keybase1.KvstoreClient{Cli: client},
	)
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

func (d daemonIdentifyUI) DisplayStellarAccount(ctx context.Context, arg keybase1.DisplayStellarAccountArg) error {
	d.log.CDebugf(ctx, "DisplayStellarAccount(%+v)", arg)
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

func (k *KeybaseDaemonRPC) registerProtocol(server *rpc.Server, p rpc.Protocol) error {
	k.log.Debug("registering protocol %q", p.Name)
	err := server.Register(p)
	switch err.(type) {
	case nil, rpc.AlreadyRegisteredError:
		return nil
	default:
		k.log.Warning("register protocol %q error", p.Name)
		return err
	}
}

// AddProtocols adds protocols that are registered on server connect
func (k *KeybaseDaemonRPC) AddProtocols(protocols []rpc.Protocol) {
	if protocols == nil {
		return
	}

	k.lock.Lock()
	defer k.lock.Unlock()

	if k.protocols != nil {
		k.protocols = append(k.protocols, protocols...)
	} else {
		k.protocols = protocols
	}

	// If we are already connected, register these protocols.
	if k.server != nil {
		for _, p := range protocols {
			err := k.registerProtocol(k.server, p)
			if err != nil {
				k.log.Debug("Couldn't register protocol: %+v", err)
			}
		}
	}
}

// OnConnect implements the ConnectionHandler interface.
func (k *KeybaseDaemonRPC) OnConnect(ctx context.Context,
	conn *rpc.Connection, rawClient rpc.GenericClient,
	server *rpc.Server) (err error) {
	k.lock.Lock()
	defer k.lock.Unlock()

	for _, p := range k.protocols {
		if err = k.registerProtocol(server, p); err != nil {
			return err
		}
	}

	// Using conn.GetClient() here would cause problematic
	// recursion.
	c := keybase1.NotifyCtlClient{Cli: rawClient}
	err = c.SetNotifications(ctx, keybase1.NotificationChannels{
		Session:       true,
		Paperkeys:     true,
		Keyfamily:     true,
		Kbfsrequest:   true,
		Reachability:  true,
		Service:       true,
		Team:          true,
		Chatkbfsedits: true,
		Favorites:     true,
	})
	if err != nil {
		return err
	}

	// Introduce ourselves. TODO: move this to SharedKeybaseConnection
	// somehow?
	configClient := keybase1.ConfigClient{Cli: rawClient}
	err = configClient.HelloIAm(ctx, keybase1.ClientDetails{
		Pid:        os.Getpid(),
		ClientType: k.config.Mode().ClientType(),
		Argv:       os.Args,
		Version:    VersionString(),
	})
	if err != nil {
		return err
	}

	// Set k.server only if err == nil.
	k.server = server

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
func (k *KeybaseDaemonRPC) OnDisconnected(ctx context.Context,
	status rpc.DisconnectStatus) {
	if status == rpc.StartingNonFirstConnection {
		k.log.Warning("KeybaseDaemonRPC is disconnected")
	}

	k.ClearCaches(ctx)

	k.lock.Lock()
	defer k.lock.Unlock()
	k.server = nil
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

func (k *KeybaseDaemonRPC) sendPing(ctx context.Context) {
	ctx, cancel := context.WithTimeout(ctx, 1*time.Second)
	defer cancel()
	err := k.sessionClient.SessionPing(ctx)
	if err != nil {
		k.log.CWarningf(
			ctx, "Background keep alive hit an error: %v", err)
	}
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
			k.sendPing(ctx)
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
	k.log.Warning("Keybase service shutdown")

}

// notifyServiceHandler implements keybase1.NotifyServiceInterface
type notifyServiceHandler struct {
	config Config
	log    logger.Logger
}

func (s *notifyServiceHandler) Shutdown(_ context.Context, code int) error {
	s.log.Warning("NotifyService: Shutdown")
	if runtime.GOOS == "windows" {
		os.Exit(code)
	}
	return nil
}

func (s *notifyServiceHandler) HTTPSrvInfoUpdate(_ context.Context, info keybase1.HttpSrvInfo) error {
	return nil
}

func (s *notifyServiceHandler) HandleKeybaseLink(_ context.Context, _ keybase1.HandleKeybaseLinkArg) error {
	return nil
}

// newNotifyServiceHandler makes a new NotifyServiceHandler
func newNotifyServiceHandler(config Config, log logger.Logger) keybase1.NotifyServiceInterface {
	s := &notifyServiceHandler{config: config, log: log}
	return s
}

// FavoritesChanged implements keybase1.NotifyFavoritesClient
func (k *KeybaseDaemonRPC) FavoritesChanged(ctx context.Context,
	uid keybase1.UID) error {
	k.log.Debug("Received FavoritesChanged RPC.")
	k.config.KBFSOps().RefreshCachedFavorites(ctx,
		FavoritesRefreshModeInMainFavoritesLoop)
	return nil
}
