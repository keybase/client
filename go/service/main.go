// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"errors"
	"io"
	"net"
	"os"
	"runtime"
	"sync"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/badges"
	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type Service struct {
	libkb.Contextified
	globals.ChatContextified

	isDaemon             bool
	chdirTo              string
	lockPid              *libkb.LockPIDFile
	ForkType             keybase1.ForkType
	startCh              chan struct{}
	stopCh               chan keybase1.ExitCode
	logForwarder         *logFwd
	gregor               *gregorHandler
	rekeyMaster          *rekeyMaster
	attachmentstore      *chat.AttachmentStore
	badger               *badges.Badger
	reachability         *reachability
	backgroundIdentifier *BackgroundIdentifier
}

type Shutdowner interface {
	Shutdown()
}

func NewService(g *libkb.GlobalContext, isDaemon bool) *Service {
	chatG := globals.NewChatContextified(&globals.ChatContext{})
	return &Service{
		Contextified:     libkb.NewContextified(g),
		ChatContextified: chatG,
		isDaemon:         isDaemon,
		startCh:          make(chan struct{}),
		stopCh:           make(chan keybase1.ExitCode),
		logForwarder:     newLogFwd(),
		rekeyMaster:      newRekeyMaster(g),
		attachmentstore:  chat.NewAttachmentStore(g.Log, g.Env.GetRuntimeDir()),
		badger:           badges.NewBadger(g),
		gregor:           newGregorHandler(globals.NewContext(g, chatG.ChatG())),
	}
}

func (d *Service) GetStartChannel() <-chan struct{} {
	return d.startCh
}

func (d *Service) RegisterProtocols(srv *rpc.Server, xp rpc.Transporter, connID libkb.ConnectionID, logReg *logRegister) (shutdowners []Shutdowner, err error) {
	g := d.G()
	cg := globals.NewContext(g, d.ChatG())
	protocols := []rpc.Protocol{
		keybase1.AccountProtocol(NewAccountHandler(xp, g)),
		keybase1.BTCProtocol(NewCryptocurrencyHandler(xp, g)),
		keybase1.CryptocurrencyProtocol(NewCryptocurrencyHandler(xp, g)),
		keybase1.ConfigProtocol(NewConfigHandler(xp, connID, g, d)),
		keybase1.CryptoProtocol(NewCryptoHandler(g)),
		keybase1.CtlProtocol(NewCtlHandler(xp, d, g)),
		keybase1.DebuggingProtocol(NewDebuggingHandler(xp)),
		keybase1.DelegateUiCtlProtocol(NewDelegateUICtlHandler(xp, connID, g, d.rekeyMaster)),
		keybase1.DeviceProtocol(NewDeviceHandler(xp, g)),
		keybase1.FavoriteProtocol(NewFavoriteHandler(xp, g)),
		keybase1.TlfProtocol(newTlfHandler(xp, cg)),
		keybase1.IdentifyProtocol(NewIdentifyHandler(xp, g)),
		keybase1.KbfsProtocol(NewKBFSHandler(xp, g, d.ChatG())),
		keybase1.KbfsMountProtocol(NewKBFSMountHandler(xp, g)),
		keybase1.LogProtocol(NewLogHandler(xp, logReg, g)),
		keybase1.LoginProtocol(NewLoginHandler(xp, g)),
		keybase1.NotifyCtlProtocol(NewNotifyCtlHandler(xp, connID, g)),
		keybase1.PGPProtocol(NewPGPHandler(xp, connID, g)),
		keybase1.ReachabilityProtocol(newReachabilityHandler(xp, g, d.reachability)),
		keybase1.RevokeProtocol(NewRevokeHandler(xp, g)),
		keybase1.ProveProtocol(NewProveHandler(xp, g)),
		keybase1.SaltpackProtocol(NewSaltpackHandler(xp, g)),
		keybase1.ScanProofsProtocol(NewScanProofsHandler(xp, g)),
		keybase1.SecretKeysProtocol(NewSecretKeysHandler(xp, g)),
		keybase1.SessionProtocol(NewSessionHandler(xp, g)),
		keybase1.SignupProtocol(NewSignupHandler(xp, g)),
		keybase1.SigsProtocol(NewSigsHandler(xp, g)),
		keybase1.TestProtocol(NewTestHandler(xp, g)),
		keybase1.TrackProtocol(NewTrackHandler(xp, g)),
		keybase1.UserProtocol(NewUserHandler(xp, g)),
		keybase1.ApiserverProtocol(NewAPIServerHandler(xp, g)),
		keybase1.PaperprovisionProtocol(NewPaperProvisionHandler(xp, g)),
		keybase1.RekeyProtocol(NewRekeyHandler2(xp, g, d.rekeyMaster)),
		keybase1.NotifyFSRequestProtocol(newNotifyFSRequestHandler(xp, g)),
		keybase1.GregorProtocol(newGregorRPCHandler(xp, g, d.gregor)),
		chat1.LocalProtocol(newChatLocalHandler(xp, cg, d.attachmentstore, d.gregor)),
		keybase1.SimpleFSProtocol(NewSimpleFSHandler(xp, g)),
		keybase1.LogsendProtocol(NewLogsendHandler(xp, g)),
		keybase1.AppStateProtocol(newAppStateHandler(xp, g)),
		keybase1.TeamsProtocol(NewTeamsHandler(xp, connID, g)),
		keybase1.BadgerProtocol(newBadgerHandler(xp, g, d.badger)),
	}
	for _, proto := range protocols {
		if err = srv.Register(proto); err != nil {
			return
		}
	}
	return
}

func (d *Service) Handle(c net.Conn) {
	xp := rpc.NewTransport(c, libkb.NewRPCLogFactory(d.G()), libkb.WrapError)

	server := rpc.NewServer(xp, libkb.WrapError)

	cl := make(chan error, 1)
	connID := d.G().NotifyRouter.AddConnection(xp, cl)

	var logReg *logRegister
	if d.isDaemon {
		// Create a new log register object that the Log handler can use to
		// register a logger.  When this function finishes, the logger
		// will be removed.
		logReg = newLogRegister(d.logForwarder, d.G().Log)
		defer logReg.UnregisterLogger()
	}
	shutdowners, err := d.RegisterProtocols(server, xp, connID, logReg)

	var shutdownOnce sync.Once
	shutdown := func() error {
		shutdownOnce.Do(func() {
			for _, shutdowner := range shutdowners {
				shutdowner.Shutdown()
			}
		})
		return nil
	}

	// Clean up handlers when the connection closes.
	defer shutdown()

	// Make sure shutdown is called when service shuts down but the connection
	// isn't closed yet.
	d.G().PushShutdownHook(shutdown)

	if err != nil {
		d.G().Log.Warning("RegisterProtocols error: %s", err)
		return
	}

	// Run the server and wait for it to finish.
	<-server.Run()
	// err is always non-nil.
	err = server.Err()
	cl <- err
	if err != io.EOF {
		d.G().Log.Warning("Run error: %s", err)
	}

	d.G().Log.Debug("Handle() complete for connection %d", connID)
}

func (d *Service) Run() (err error) {
	defer func() {
		if d.startCh != nil {
			close(d.startCh)
		}
		d.G().NotifyRouter.HandleServiceShutdown()
		d.G().Log.Debug("From Service.Run(): exit with code %d\n", d.G().ExitCode)
	}()

	d.G().Log.Debug("+ service starting up; forkType=%v", d.ForkType)

	// Sets this global context to "service" mode which will toggle a flag
	// and will also set in motion various go-routine based managers
	d.G().SetService()
	uir := NewUIRouter(d.G())
	d.G().SetUIRouter(uir)

	// register the service's logForwarder as the external handler for the log module:
	d.G().Log.SetExternalHandler(d.logForwarder)

	err = d.writeServiceInfo()
	if err != nil {
		return
	}

	if len(d.chdirTo) != 0 {
		etmp := os.Chdir(d.chdirTo)
		if etmp != nil {
			d.G().Log.Warning("Could not change directory to %s: %s", d.chdirTo, etmp)
		} else {
			d.G().Log.Info("Changing runtime dir to %s", d.chdirTo)
		}
	}

	if d.G().Env.GetServiceType() == "launchd" {
		d.ForkType = keybase1.ForkType_LAUNCHD
	}

	if err = d.GetExclusiveLock(); err != nil {
		return
	}
	if err = d.cleanupSocketFile(); err != nil {
		return
	}

	if err = d.G().LocalDb.ForceOpen(); err != nil {
		return err
	}
	if err = d.G().LocalChatDb.ForceOpen(); err != nil {
		return err
	}

	var l net.Listener
	if l, err = d.ConfigRPCServer(); err != nil {
		return
	}

	d.RunBackgroundOperations(uir)

	d.G().ExitCode, err = d.ListenLoopWithStopper(l)

	return err
}

func (d *Service) RunBackgroundOperations(uir *UIRouter) {
	// These are all background-ish operations that the service performs.
	// We should revisit these on mobile, or at least, when mobile apps are
	// backgrounded.
	d.tryLogin()
	d.hourlyChecks()
	d.createChatModules()
	d.startupGregor()
	d.startChatModules()
	d.addGlobalHooks()
	d.configurePath()
	d.configureRekey(uir)
	d.runBackgroundIdentifier()
	d.runBackgroundPerUserKeyUpgrade()
}

func (d *Service) startChatModules() {
	uid := d.G().Env.GetUID()
	if !uid.IsNil() {
		uid := d.G().Env.GetUID().ToBytes()
		g := globals.NewContext(d.G(), d.ChatG())
		g.MessageDeliverer.Start(context.Background(), uid)
		g.ConvLoader.Start(context.Background(), uid)
		g.FetchRetrier.Start(context.Background(), uid)
	}
}

func (d *Service) stopChatModules() {
	<-d.ChatG().MessageDeliverer.Stop(context.Background())
	<-d.ChatG().ConvLoader.Stop(context.Background())
	<-d.ChatG().FetchRetrier.Stop(context.Background())
}

func (d *Service) createChatModules() {
	g := globals.NewContext(d.G(), d.ChatG())
	ri := d.gregor.GetClient
	tlf := chat.NewKBFSTLFInfoSource(g)

	// Set up main chat data sources
	boxer := chat.NewBoxer(g, tlf)
	g.InboxSource = chat.NewInboxSource(g, g.Env.GetInboxSourceType(), ri, tlf)
	g.ConvSource = chat.NewConversationSource(g, g.Env.GetConvSourceType(),
		boxer, storage.New(g), ri)
	g.ServerCacheVersions = storage.NewServerVersions(g)

	// Syncer and retriers
	chatSyncer := chat.NewSyncer(g)
	g.Syncer = chatSyncer
	g.FetchRetrier = chat.NewFetchRetrier(g)
	g.ConvLoader = chat.NewBackgroundConvLoader(g)

	// Set up push handler with the badger
	d.badger.SetInboxVersionSource(storage.NewInboxVersionSource(g))
	pushHandler := chat.NewPushHandler(g)
	pushHandler.SetBadger(d.badger)
	g.PushHandler = pushHandler

	// Message sending apparatus
	sender := chat.NewBlockingSender(g, chat.NewBoxer(g, tlf), d.attachmentstore, ri)
	g.MessageDeliverer = chat.NewDeliverer(g, sender)

	// Set up Offlinables on Syncer
	chatSyncer.RegisterOfflinable(g.InboxSource)
	chatSyncer.RegisterOfflinable(g.ConvSource)
	chatSyncer.RegisterOfflinable(g.FetchRetrier)
	chatSyncer.RegisterOfflinable(g.MessageDeliverer)

	// Add a tlfHandler into the user changed handler group so we can keep identify info
	// fresh
	g.AddUserChangedHandler(chat.NewIdentifyChangedHandler(g, tlf))
}

func (d *Service) configureRekey(uir *UIRouter) {
	rkm := d.rekeyMaster
	rkm.uiRouter = uir
	d.gregor.PushHandler(rkm)
	// the rekey master needs to query gregor state, so we have
	// this unfortunate dependency injection
	rkm.gregor = d.gregor
	rkm.Start()
}

func (d *Service) runBackgroundIdentifier() {
	uid := d.G().Env.GetUID()
	if !uid.IsNil() {
		d.runBackgroundIdentifierWithUID(uid)
	}
}

func (d *Service) startupGregor() {
	g := d.G()
	if g.Env.GetGregorDisabled() {
		g.Log.Debug("Gregor explicitly disabled")
	} else if !g.Env.GetTorMode().UseSession() {
		g.Log.Debug("Gregor disabled in Tor mode")
	} else {
		g.Log.Debug("connecting to gregord for push notifications")

		// Create gregorHandler instance first so any handlers can connect
		// to it before we actually connect to gregor (either gregor is down
		// or we aren't logged in)
		d.gregor.Init()
		d.reachability = newReachability(d.G(), d.gregor)
		d.gregor.setReachability(d.reachability)
		d.G().ConnectivityMonitor = d.reachability

		d.gregor.badger = d.badger
		d.G().GregorDismisser = d.gregor
		d.G().GregorListener = d.gregor

		// Add default handlers
		d.gregor.PushHandler(newUserHandler(d.G()))
		// TODO -- get rid of this?
		d.gregor.PushHandler(newRekeyLogHandler(d.G()))

		// Connect to gregord
		if gcErr := d.tryGregordConnect(); gcErr != nil {
			g.Log.Debug("error connecting to gregord: %s", gcErr)
		}
	}
}

func (d *Service) addGlobalHooks() {
	d.G().AddLoginHook(d)
	d.G().AddLogoutHook(d)
}

func (d *Service) StartLoopbackServer() error {

	var l net.Listener
	var err error

	if err = d.GetExclusiveLock(); err != nil {
		return err
	}

	if l, err = d.G().MakeLoopbackServer(); err != nil {
		return err
	}

	// Make sure we have the same keys in memory in standalone mode as we do in
	// regular service mode.
	d.tryLogin()

	go d.ListenLoop(l)

	return nil
}

func (d *Service) ensureRuntimeDir() (string, error) {
	runtimeDir := d.G().Env.GetRuntimeDir()
	return runtimeDir, os.MkdirAll(runtimeDir, libkb.PermDir)
}

// If the daemon is already running, we need to be able to check what version
// it is, in case the client has been updated.
func (d *Service) writeServiceInfo() error {
	_, err := d.ensureRuntimeDir()
	if err != nil {
		return err
	}

	// Write runtime info file
	rtInfo := libkb.KeybaseServiceInfo(d.G())
	return rtInfo.WriteFile(d.G().Env.GetServiceInfoPath(), d.G().Log)
}

func (d *Service) hourlyChecks() {
	ticker := time.NewTicker(1 * time.Hour)
	d.G().PushShutdownHook(func() error {
		d.G().Log.Debug("stopping hourlyChecks loop")
		ticker.Stop()
		return nil
	})
	go func() {
		for {
			<-ticker.C
			d.G().Log.Debug("+ hourly check loop")
			d.G().Log.Debug("| checking tracks on an hour timer")
			libkb.CheckTracking(d.G())
			d.G().Log.Debug("| checking if current device revoked")
			if err := d.G().LogoutIfRevoked(); err != nil {
				d.G().Log.Debug("LogoutIfRevoked error: %s", err)
			}
			d.G().Log.Debug("- hourly check loop")
		}
	}()
}

func (d *Service) tryGregordConnect() error {
	// If we're logged out, LoggedInLoad() will return false with no error,
	// even if the network is down. However, if we're logged in and the network
	// is down, it will still return false, along with the network error. We
	// need to handle that case specifically, so that we still start the gregor
	// connect loop.
	loggedIn, err := d.G().LoginState().LoggedInProvisioned()
	if err != nil {
		// A network error means we *think* we're logged in, and we tried to
		// confirm with the API server. In that case we'll swallow the error
		// and allow control to proceeed to the gregor loop. We'll still
		// short-circuit for any unexpected errors though.
		_, isNetworkError := err.(libkb.APINetError)
		if !isNetworkError {
			d.G().Log.Warning("Unexpected non-network error in tryGregordConnect: %s", err)
			return err
		}
	} else if !loggedIn {
		// We only respect the loggedIn flag in the no-error case.
		d.G().Log.Debug("not logged in, so not connecting to gregord")
		return nil
	}

	return d.gregordConnect()
}

func (d *Service) runBackgroundIdentifierWithUID(u keybase1.UID) {
	if d.G().Env.GetBGIdentifierDisabled() {
		d.G().Log.Debug("BackgroundIdentifier disabled")
		return
	}

	newBgi, err := StartOrReuseBackgroundIdentifier(d.backgroundIdentifier, d.G(), d.ChatG(), u)
	if err != nil {
		d.G().Log.Warning("Problem running new background identifier: %s", err)
		return
	}
	if newBgi == nil {
		d.G().Log.Debug("No new background identifier needed")
		return
	}
	d.backgroundIdentifier = newBgi
	d.G().AddUserChangedHandler(newBgi)
}

func (d *Service) runBackgroundPerUserKeyUpgrade() {
	if !d.G().Env.GetUpgradePerUserKey() {
		d.G().Log.Debug("PerUserKeyBackground disabled (not starting)")
		return
	}

	arg := &engine.PerUserKeyBackgroundArgs{
		Settings: engine.PerUserKeyBackgroundDefaultSettings,
	}
	eng := engine.NewPerUserKeyBackground(d.G(), arg)
	go func() {
		ectx := &engine.Context{NetContext: context.Background()}
		err := engine.RunEngine(eng, ectx)
		if err != nil {
			d.G().Log.Warning("per-user-key background upgrade error: %v", err)
		}
	}()

	d.G().PushShutdownHook(func() error {
		d.G().Log.Debug("stopping per-user-key background upgrade")
		eng.Shutdown()
		return nil
	})
}

func (d *Service) OnLogin() error {
	d.rekeyMaster.Login()
	if err := d.gregordConnect(); err != nil {
		return err
	}
	uid := d.G().Env.GetUID()
	if !uid.IsNil() {
		d.startChatModules()
		d.runBackgroundIdentifierWithUID(uid)
	}
	return nil
}

func (d *Service) OnLogout() (err error) {
	defer d.G().Trace("Service#OnLogout", func() error { return err })()

	log := func(s string) {
		d.G().Log.Debug("Service#OnLogout: %s", s)
	}

	log("shutting down gregor")
	if d.gregor != nil {
		d.gregor.Shutdown()
	}

	log("shutting down chat modules")
	d.stopChatModules()

	log("shutting down rekeyMaster")
	d.rekeyMaster.Logout()

	log("shutting down badger")
	if d.badger != nil {
		d.badger.Clear(context.TODO())
	}

	log("shutting down BG identifier")
	if d.backgroundIdentifier != nil {
		d.backgroundIdentifier.Logout()
	}

	return nil
}

func (d *Service) gregordConnect() (err error) {
	var uri *rpc.FMPURI
	defer d.G().Trace("gregordConnect", func() error { return err })()

	uri, err = rpc.ParseFMPURI(d.G().Env.GetGregorURI())
	if err != nil {
		return err
	}
	d.G().Log.Debug("| gregor URI: %s", uri)

	// If we are already connected, then shutdown and reset the gregor
	// handler
	if d.gregor.IsConnected() {
		if d.gregor.Reset(); err != nil {
			return err
		}
	}

	// Connect to gregord
	if err = d.gregor.Connect(uri); err != nil {
		return err
	}

	return nil
}

// ReleaseLock releases the locking pidfile by closing, unlocking and
// deleting it.
func (d *Service) ReleaseLock() error {
	d.G().Log.Debug("Releasing lock file")
	return d.lockPid.Close()
}

// GetExclusiveLockWithoutAutoUnlock grabs the exclusive lock over running
// keybase and continues to hold the lock. The caller is then required to
// manually release this lock via ReleaseLock()
func (d *Service) GetExclusiveLockWithoutAutoUnlock() error {
	if _, err := d.ensureRuntimeDir(); err != nil {
		return err
	}
	if err := d.lockPIDFile(); err != nil {
		return err
	}
	return nil
}

// GetExclusiveLock grabs the exclusive lock over running keybase
// and then installs a shutdown hook to release the lock automatically
// on shutdown.
func (d *Service) GetExclusiveLock() error {
	if err := d.GetExclusiveLockWithoutAutoUnlock(); err != nil {
		return err
	}
	d.G().PushShutdownHook(func() error {
		return d.ReleaseLock()
	})
	return nil
}

func (d *Service) cleanupSocketFile() error {
	sf, err := d.G().Env.GetSocketBindFile()
	if err != nil {
		return err
	}
	if exists, err := libkb.FileExists(sf); err != nil {
		return err
	} else if exists {
		d.G().Log.Debug("removing stale socket file: %s", sf)
		if err = os.Remove(sf); err != nil {
			d.G().Log.Warning("error removing stale socket file: %s", err)
			return err
		}
	}
	return nil
}

func (d *Service) lockPIDFile() (err error) {
	var fn string
	if fn, err = d.G().Env.GetPidFile(); err != nil {
		return
	}
	d.lockPid = libkb.NewLockPIDFile(fn)
	if err = d.lockPid.Lock(); err != nil {
		return err
	}
	d.G().Log.Debug("Locking pidfile %s\n", fn)
	return nil
}

func (d *Service) ConfigRPCServer() (l net.Listener, err error) {
	if l, err = d.G().BindToSocket(); err != nil {
		return
	}
	if d.startCh != nil {
		close(d.startCh)
		d.startCh = nil
	}
	return
}

func (d *Service) Stop(exitCode keybase1.ExitCode) {
	d.stopCh <- exitCode
}

func (d *Service) ListenLoopWithStopper(l net.Listener) (exitCode keybase1.ExitCode, err error) {
	ch := make(chan error)
	go func() {
		ch <- d.ListenLoop(l)
	}()
	exitCode = <-d.stopCh
	l.Close()
	d.G().Log.Debug("Left listen loop w/ exit code %d\n", exitCode)
	return exitCode, <-ch
}

func (d *Service) ListenLoop(l net.Listener) (err error) {
	d.G().Log.Debug("+ Enter ListenLoop()")
	for {
		var c net.Conn
		if c, err = l.Accept(); err != nil {

			if libkb.IsSocketClosedError(err) {
				err = nil
			}

			d.G().Log.Debug("+ Leaving ListenLoop() w/ error %v", err)
			return
		}
		go d.Handle(c)
	}
}

func (d *Service) ParseArgv(ctx *cli.Context) error {
	d.chdirTo = ctx.String("chdir")
	if ctx.Bool("auto-forked") {
		d.ForkType = keybase1.ForkType_AUTO
	} else if ctx.Bool("watchdog-forked") {
		d.ForkType = keybase1.ForkType_WATCHDOG
	} else if ctx.Bool("launchd-forked") {
		d.ForkType = keybase1.ForkType_LAUNCHD
	}
	return nil
}

func NewCmdService(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name: "service",
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "chdir",
				Usage: "Specify where to run as a daemon (via chdir)",
			},
			cli.StringFlag{
				Name:  "label",
				Usage: "Specifying a label can help identify services.",
			},
			cli.BoolFlag{
				Name:  "auto-forked",
				Usage: "Specify if this binary was auto-forked from the client",
			},
			cli.BoolFlag{
				Name:  "watchdog-forked",
				Usage: "Specify if this binary was started by the watchdog",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewService(g, true /* isDaemon */), "service", c)
			cl.SetService()
		},
	}
}

func (d *Service) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		KbKeyring:  true,
		GpgKeyring: true,
		API:        true,
		Socket:     true,
	}
}

func GetCommands(cl *libcmdline.CommandLine, g *libkb.GlobalContext) []cli.Command {
	return []cli.Command{
		NewCmdService(cl, g),
	}
}

func (d *Service) GregorDismiss(id gregor.MsgID) error {
	if d.gregor == nil {
		return errors.New("can't gregor dismiss without a gregor")
	}
	return d.gregor.DismissItem(id)
}

func (d *Service) GregorInject(cat string, body []byte) (gregor.MsgID, error) {
	if d.gregor == nil {
		return nil, errors.New("can't gregor inject without a gregor")
	}
	return d.gregor.InjectItem(cat, body)
}

func (d *Service) GregorInjectOutOfBandMessage(sys string, body []byte) error {
	if d.gregor == nil {
		return errors.New("can't gregor inject without a gregor")
	}
	return d.gregor.InjectOutOfBandMessage(sys, body)
}

func (d *Service) HasGregor() bool {
	return d.gregor != nil && d.gregor.IsConnected()
}

func (d *Service) SimulateGregorCrashForTesting() {
	if d.HasGregor() {
		d.gregor.simulateCrashForTesting()
	} else {
		d.G().Log.Warning("Can't simulate a gregor crash without a gregor")
	}
}

func (d *Service) SetGregorPushStateFilter(f func(m gregor.Message) bool) {
	d.gregor.SetPushStateFilter(f)
}

// configurePath is a somewhat unfortunate hack, but as it currently stands,
// when the keybase service is run out of launchd, its path is minimal and
// often can't find the GPG location. We have hacks around this for CLI operation,
// in which the CLI forwards its path to the service, and the service enlarges
// its path accordingly. In this way, the service can get access to path additions
// inserted by the user's shell startup scripts. However the same mechanism doesn't
// apply to a GUI-driven workload, since the Electron GUI, like the Go service, is
// launched from launchd and therefore has the wrong path. This function currently
// noops on all platforms aside from macOS, but we can expand it later as needs be.
func (d *Service) configurePath() {
	defer d.G().Trace("Service#configurePath", func() error { return nil })()

	var newDirs string
	switch runtime.GOOS {
	case "darwin":
		newDirs = "/usr/local/bin:/usr/local/MacGPG2/bin"
	default:
	}
	if newDirs != "" {
		mergeIntoPath(d.G(), newDirs)
	}
}

// tryLogin runs LoginOffline which will load the local session file and unlock the
// local device keys without making any network requests.
//
// If that fails for any reason, LoginProvisionedDevice is used, which should get
// around any issue where the session.json file is out of date or missing since the
// last time the service started.
func (d *Service) tryLogin() {
	eng := engine.NewLoginOffline(d.G())
	ctx := &engine.Context{}
	if err := engine.RunEngine(eng, ctx); err != nil {
		d.G().Log.Debug("error running LoginOffline on service startup: %s", err)
		d.G().Log.Debug("trying LoginProvisionedDevice")

		// Standalone mode quirk here. We call tryLogin when client is
		// launched in standalone to unlock the same keys that we would
		// have in service mode. But NewLoginProvisionedDevice engine
		// needs KbKeyrings and not every command sets it up. Ensure
		// Keyring is available.
		if d.G().Keyrings == nil {
			d.G().Log.Debug("tryLogin: Configuring Keyrings")
			d.G().ConfigureKeyring()
		}

		deng := engine.NewLoginProvisionedDevice(d.G(), "")
		deng.SecretStoreOnly = true
		ctx := &engine.Context{
			NetContext: context.Background(),
		}
		if err := engine.RunEngine(deng, ctx); err != nil {
			d.G().Log.Debug("error running LoginProvisionedDevice on service startup: %s", err)
		}
	} else {
		d.G().Log.Debug("success running LoginOffline on service startup")
	}
}
