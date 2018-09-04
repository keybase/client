// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"errors"
	"io"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"runtime/pprof"
	"runtime/trace"
	"sync"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/avatars"
	"github.com/keybase/client/go/badges"
	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/ephemeral"
	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/home"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/pvlsource"
	"github.com/keybase/client/go/stellar"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/keybase/client/go/stellar/stellargregor"
	"github.com/keybase/client/go/systemd"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/client/go/tlfupgrade"
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
	badger               *badges.Badger
	reachability         *reachability
	backgroundIdentifier *BackgroundIdentifier
	home                 *home.Home
	tlfUpgrader          *tlfupgrade.BackgroundTLFUpdater
	avatarLoader         avatars.Source
}

type Shutdowner interface {
	Shutdown()
}

func NewService(g *libkb.GlobalContext, isDaemon bool) *Service {
	chatG := globals.NewChatContextified(&globals.ChatContext{})
	allG := globals.NewContext(g, chatG.ChatG())
	return &Service{
		Contextified:     libkb.NewContextified(g),
		ChatContextified: chatG,
		isDaemon:         isDaemon,
		startCh:          make(chan struct{}),
		stopCh:           make(chan keybase1.ExitCode),
		logForwarder:     newLogFwd(),
		rekeyMaster:      newRekeyMaster(g),
		badger:           badges.NewBadger(g),
		gregor:           newGregorHandler(allG),
		home:             home.NewHome(g),
		tlfUpgrader:      tlfupgrade.NewBackgroundTLFUpdater(g),
		avatarLoader:     avatars.CreateSourceFromEnv(g),
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
		keybase1.DebuggingProtocol(NewDebuggingHandler(xp, g)),
		keybase1.DelegateUiCtlProtocol(NewDelegateUICtlHandler(xp, connID, g, d.rekeyMaster)),
		keybase1.DeviceProtocol(NewDeviceHandler(xp, g)),
		keybase1.FavoriteProtocol(NewFavoriteHandler(xp, g)),
		keybase1.TlfProtocol(newTlfHandler(xp, cg)),
		keybase1.IdentifyProtocol(NewIdentifyHandler(xp, g)),
		keybase1.InstallProtocol(NewInstallHandler(xp, g)),
		keybase1.KbfsProtocol(NewKBFSHandler(xp, g, d.ChatG())),
		keybase1.KbfsMountProtocol(NewKBFSMountHandler(xp, g)),
		keybase1.LogProtocol(NewLogHandler(xp, logReg, g)),
		keybase1.LoginProtocol(NewLoginHandler(xp, g)),
		keybase1.NotifyCtlProtocol(NewNotifyCtlHandler(xp, connID, g)),
		keybase1.PGPProtocol(NewPGPHandler(xp, connID, g)),
		keybase1.PprofProtocol(NewPprofHandler(xp, g)),
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
		keybase1.UserProtocol(NewUserHandler(xp, g, d.ChatG())),
		CancellingProtocol(g, keybase1.ApiserverProtocol(NewAPIServerHandler(xp, g))),
		keybase1.PaperprovisionProtocol(NewPaperProvisionHandler(xp, g)),
		keybase1.SelfprovisionProtocol(NewSelfProvisionHandler(xp, g)),
		keybase1.RekeyProtocol(NewRekeyHandler2(xp, g, d.rekeyMaster)),
		keybase1.NotifyFSRequestProtocol(newNotifyFSRequestHandler(xp, g)),
		keybase1.GregorProtocol(newGregorRPCHandler(xp, g, d.gregor)),
		CancellingProtocol(g, chat1.LocalProtocol(newChatLocalHandler(xp, cg, d.gregor))),
		keybase1.SimpleFSProtocol(NewSimpleFSHandler(xp, g)),
		keybase1.LogsendProtocol(NewLogsendHandler(xp, g)),
		keybase1.AppStateProtocol(newAppStateHandler(xp, g)),
		CancellingProtocol(g, keybase1.TeamsProtocol(NewTeamsHandler(xp, connID, cg, d.gregor))),
		keybase1.BadgerProtocol(newBadgerHandler(xp, g, d.badger)),
		keybase1.MerkleProtocol(newMerkleHandler(xp, g)),
		keybase1.GitProtocol(NewGitHandler(xp, g)),
		keybase1.HomeProtocol(NewHomeHandler(xp, g, d.home)),
		keybase1.AvatarsProtocol(NewAvatarHandler(xp, g, d.avatarLoader)),
		stellar1.LocalProtocol(newWalletHandler(xp, g)),
	}
	for _, proto := range protocols {
		if err = srv.Register(proto); err != nil {
			return
		}
	}
	return
}

func (d *Service) Handle(c net.Conn) {
	xp := rpc.NewTransport(c, libkb.NewRPCLogFactory(d.G()), libkb.MakeWrapError(d.G()))

	server := rpc.NewServer(xp, libkb.MakeWrapError(d.G()))

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

		d.stopProfile()

		if d.startCh != nil {
			close(d.startCh)
		}
		d.G().NotifyRouter.HandleServiceShutdown()
		d.G().Log.Debug("From Service.Run(): exit with code %d\n", d.G().ExitCode)
	}()

	d.G().Log.Debug("+ service starting up; forkType=%v", d.ForkType)

	d.startProfile()

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

	switch d.G().Env.GetServiceType() {
	case "":
		// Not set, do nothing.
	case "launchd":
		d.ForkType = keybase1.ForkType_LAUNCHD
	case "systemd":
		d.ForkType = keybase1.ForkType_SYSTEMD
	default:
		d.G().Log.Warning("Unknown service type: %q", d.G().Env.GetServiceType())
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
		return err
	}

	if err = d.SetupCriticalSubServices(); err != nil {
		return err
	}

	d.RunBackgroundOperations(uir)

	// At this point initialization is complete, and we're about to start the
	// listen loop. This is the natural point to report "startup successful" to
	// the supervisor (currently just systemd on Linux). This isn't necessary
	// for correctness, but it allows commands like "systemctl start keybase.service"
	// to report startup errors to the terminal, by delaying their return
	// until they get this notification (Type=notify, in systemd lingo).
	systemd.NotifyStartupFinished()

	d.G().ExitCode, err = d.ListenLoopWithStopper(l)

	return err
}

func (d *Service) SetupCriticalSubServices() error {
	epick := libkb.FirstErrorPicker{}
	epick.Push(d.setupTeams())
	epick.Push(d.setupStellar())
	epick.Push(d.setupPVL())
	epick.Push(d.setupEphemeralKeys())
	return epick.Error()
}

func (d *Service) setupEphemeralKeys() error {
	ephemeral.ServiceInit(d.G())
	return nil
}

func (d *Service) setupTeams() error {
	teams.ServiceInit(d.G())
	return nil
}

func (d *Service) setupStellar() error {
	stellar.ServiceInit(d.G(), remote.NewRemoteNet(d.G()))
	return nil
}

func (d *Service) setupPVL() error {
	pvlsource.NewPvlSourceAndInstall(d.G())
	return nil
}

func (d *Service) RunBackgroundOperations(uir *UIRouter) {
	// These are all background-ish operations that the service performs.
	// We should revisit these on mobile, or at least, when mobile apps are
	// backgrounded.
	ctx := context.Background()
	d.tryLogin(ctx)
	d.chatOutboxPurgeCheck()
	d.hourlyChecks()
	d.slowChecks() // 6 hours
	d.createChatModules()
	d.startupGregor()
	d.startChatModules()
	d.addGlobalHooks()
	d.configurePath()
	d.configureRekey(uir)
	d.runBackgroundIdentifier()
	d.runBackgroundPerUserKeyUpgrade()
	d.runBackgroundPerUserKeyUpkeep()
	d.runBackgroundWalletInit()
	d.runBackgroundWalletUpkeep()
	d.runTLFUpgrade()
	go d.identifySelf()
}

func (d *Service) purgeOldChatAttachmentData() {
	purge := func(glob string) {
		files, err := filepath.Glob(filepath.Join(d.G().GetCacheDir(), glob))
		if err != nil {
			d.G().Log.Debug("purgeOldChatAttachmentData: failed to get %s files: %s", glob, err)
		} else {
			for _, f := range files {
				if err := os.Remove(f); err != nil {
					d.G().Log.Debug("purgeOldChatAttachmentData: failed to remove: name: %s err: %s", f, err)
				}
			}
		}
	}
	purge("kbchat*")
	purge("prev*")
}

func (d *Service) startChatModules() {
	uid := d.G().Env.GetUID()
	if !uid.IsNil() {
		uid := d.G().Env.GetUID().ToBytes()
		g := globals.NewContext(d.G(), d.ChatG())
		g.MessageDeliverer.Start(context.Background(), uid)
		g.ConvLoader.Start(context.Background(), uid)
		g.FetchRetrier.Start(context.Background(), uid)
		g.EphemeralPurger.Start(context.Background(), uid)
	}
	d.purgeOldChatAttachmentData()
}

func (d *Service) stopChatModules() {
	<-d.ChatG().MessageDeliverer.Stop(context.Background())
	<-d.ChatG().ConvLoader.Stop(context.Background())
	<-d.ChatG().FetchRetrier.Stop(context.Background())
	<-d.ChatG().EphemeralPurger.Stop(context.Background())
}

func (d *Service) createChatModules() {
	g := globals.NewContext(d.G(), d.ChatG())
	ri := d.gregor.GetClient

	// Set up main chat data sources
	boxer := chat.NewBoxer(g)
	chatStorage := storage.New(g, nil)
	g.InboxSource = chat.NewInboxSource(g, g.Env.GetInboxSourceType(), ri)
	g.ConvSource = chat.NewConversationSource(g, g.Env.GetConvSourceType(),
		boxer, chatStorage, ri)
	chatStorage.SetAssetDeleter(g.ConvSource)
	g.Searcher = chat.NewSearcher(g)
	g.ServerCacheVersions = storage.NewServerVersions(g)

	// Syncer and retriers
	chatSyncer := chat.NewSyncer(g)
	g.Syncer = chatSyncer
	g.FetchRetrier = chat.NewFetchRetrier(g)
	g.ConvLoader = chat.NewBackgroundConvLoader(g)
	g.EphemeralPurger = chat.NewBackgroundEphemeralPurger(g, chatStorage)
	g.ActivityNotifier = chat.NewNotifyRouterActivityRouter(g)

	// Set up push handler with the badger
	d.badger.SetInboxVersionSource(storage.NewInboxVersionSource(g))
	pushHandler := chat.NewPushHandler(g)
	pushHandler.SetBadger(d.badger)
	g.PushHandler = pushHandler

	// Message sending apparatus
	store := attachments.NewS3Store(g.GetLog(), g.GetRuntimeDir())
	g.AttachmentUploader = attachments.NewUploader(g, store, attachments.NewS3Signer(ri), ri)
	sender := chat.NewBlockingSender(g, chat.NewBoxer(g), ri)
	g.MessageDeliverer = chat.NewDeliverer(g, sender)

	// team channel source
	g.TeamChannelSource = chat.NewCachingTeamChannelSource(g, ri)

	g.AttachmentURLSrv = chat.NewAttachmentHTTPSrv(g, chat.NewCachingAttachmentFetcher(g, store, 1000), ri)

	// payment loader
	paymentLoader := stellar.NewPaymentLoader(g.ExternalG())
	g.PaymentLoader = paymentLoader
	g.PushShutdownHook(paymentLoader.Shutdown)

	// Set up Offlinables on Syncer
	chatSyncer.RegisterOfflinable(g.InboxSource)
	chatSyncer.RegisterOfflinable(g.ConvSource)
	chatSyncer.RegisterOfflinable(g.FetchRetrier)
	chatSyncer.RegisterOfflinable(g.MessageDeliverer)

	// Add a tlfHandler into the user changed handler group so we can keep identify info
	// fresh
	g.AddUserChangedHandler(chat.NewIdentifyChangedHandler(g))

	g.ChatHelper = chat.NewHelper(g, ri)
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

func (d *Service) identifySelf() {
	uid := d.G().Env.GetUID()
	if uid.IsNil() {
		d.G().Log.Debug("identifySelf: no uid, skipping")
		return
	}
	d.G().Log.Debug("identifySelf: running identify on uid %s", uid)
	arg := keybase1.Identify2Arg{
		Uid: uid,
		Reason: keybase1.IdentifyReason{
			Type: keybase1.IdentifyReasonType_BACKGROUND,
		},
		AlwaysBlock:      true,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_GUI,
		NoSkipSelf:       true,
		NeedProofSet:     true,
	}
	eng := engine.NewIdentify2WithUID(d.G(), &arg)
	m := libkb.NewMetaContextBackground(d.G())
	if err := engine.RunEngine2(m, eng); err != nil {
		d.G().Log.Debug("identifySelf: identify error %s", err)
	}
	d.G().Log.Debug("identifySelf: identify success on uid %s", uid)

	// identify2 did a load user for self, so find it and cache it in FullSelfer.
	them := eng.FullThemUser()
	me := eng.FullMeUser()
	var self *libkb.User
	if them != nil && them.GetUID().Equal(uid) {
		d.G().Log.Debug("identifySelf: using them for full user")
		self = them
	} else if me != nil && me.GetUID().Equal(uid) {
		d.G().Log.Debug("identifySelf: using me for full user")
		self = me
	}
	if self != nil {
		if err := d.G().GetFullSelfer().Update(context.Background(), self); err != nil {
			d.G().Log.Debug("identifySelf: error updating full self cache: %s", err)
		} else {
			d.G().Log.Debug("identifySelf: updated full self cache for: %s", self.GetName())
		}
	}
}

func (d *Service) runTLFUpgrade() {
	d.tlfUpgrader.Run()
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

		d.gregor.PushHandler(newTeamHandler(d.G(), d.badger))
		d.gregor.PushHandler(stellargregor.New(d.G(), remote.NewRemoteNet(d.G())))
		d.gregor.PushHandler(d.home)
		d.gregor.PushHandler(newEKHandler(d.G()))
		d.gregor.PushHandler(newAvatarGregorHandler(d.G(), d.avatarLoader))

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

	ctx := context.Background()

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
	d.tryLogin(ctx)

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

func (d *Service) chatOutboxPurgeCheck() {
	ticker := libkb.NewBgTicker(5 * time.Minute)
	m := libkb.NewMetaContextBackground(d.G()).WithLogTag("OBOXPRGE")
	d.G().PushShutdownHook(func() error {
		m.CDebugf("stopping chatOutboxPurgeCheck loop")
		ticker.Stop()
		return nil
	})
	go func() {
		for {
			<-ticker.C
			uid := d.G().Env.GetUID()
			if uid.IsNil() {
				continue
			}
			gregorUID := gregor1.UID(uid.ToBytes())
			g := globals.NewContext(d.G(), d.ChatG())
			ephemeralPurged, err := storage.NewOutbox(g, gregorUID).OutboxPurge(context.Background())
			if err != nil {
				m.CDebugf("OutboxPurge error: %s", err)
				continue
			}
			if len(ephemeralPurged) > 0 {
				act := chat1.NewChatActivityWithFailedMessage(chat1.FailedMessageInfo{
					OutboxRecords:    ephemeralPurged,
					IsEphemeralPurge: true,
				})
				d.ChatG().ActivityNotifier.Activity(context.Background(), gregorUID, chat1.TopicType_NONE,
					&act, chat1.ChatActivitySource_LOCAL)
			}
		}
	}()
}

func (d *Service) hourlyChecks() {
	ticker := libkb.NewBgTicker(1 * time.Hour)
	m := libkb.NewMetaContextBackground(d.G()).WithLogTag("HRLY")
	d.G().PushShutdownHook(func() error {
		m.CDebugf("stopping hourlyChecks loop")
		ticker.Stop()
		return nil
	})
	go func() {
		// do this quickly
		if err := m.LogoutAndDeprovisionIfRevoked(); err != nil {
			m.CDebugf("LogoutAndDeprovisionIfRevoked error: %s", err)
		}
		for {
			<-ticker.C
			m.CDebugf("+ hourly check loop")
			m.CDebugf("| checking if current device revoked")
			if err := m.LogoutAndDeprovisionIfRevoked(); err != nil {
				m.CDebugf("LogoutAndDeprovisionIfRevoked error: %s", err)
			}

			m.CDebugf("| checking tracks on an hour timer")
			libkb.CheckTracking(m.G())

			m.CDebugf("- hourly check loop")
		}
	}()
}

func (d *Service) deviceCloneSelfCheck() error {
	m := libkb.NewMetaContextBackground(d.G())
	m = m.WithLogTag("CLONE")
	before, after, err := libkb.UpdateDeviceCloneState(m)
	if err != nil {
		return err
	}
	newClones := after - before

	m.CDebugf("deviceCloneSelfCheck: is there a new clone? %v", newClones > 0)
	if newClones > 0 {
		m.CDebugf("deviceCloneSelfCheck: notifying user %v -> %v restarts", before, after)
		d.G().NotifyRouter.HandleDeviceCloneNotification(newClones)
	}
	return nil
}

func (d *Service) slowChecks() {
	ticker := libkb.NewBgTicker(6 * time.Hour)
	d.G().PushShutdownHook(func() error {
		d.G().Log.Debug("stopping slowChecks loop")
		ticker.Stop()
		return nil
	})
	// Do this once fast
	if err := d.deviceCloneSelfCheck(); err != nil {
		d.G().Log.Debug("deviceCloneSelfCheck error: %s", err)
	}
	go func() {
		for {
			<-ticker.C
			d.G().Log.Debug("+ slow checks loop")
			d.G().Log.Debug("| checking if current device should log out")
			if err := d.G().LogoutSelfCheck(); err != nil {
				d.G().Log.Debug("LogoutSelfCheck error: %s", err)
			}
			d.G().Log.Debug("| checking if current device is a clone")
			if err := d.deviceCloneSelfCheck(); err != nil {
				d.G().Log.Debug("deviceCloneSelfCheck error: %s", err)
			}
			d.G().Log.Debug("- slow checks loop")
		}
	}()
}

func (d *Service) tryGregordConnect() error {
	loggedIn := d.G().ActiveDevice.Valid()
	if !loggedIn {
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
		d.G().Log.Debug("PerUserKeyUpgradeBackground disabled (not starting)")
		return
	}

	eng := engine.NewPerUserKeyUpgradeBackground(d.G(), &engine.PerUserKeyUpgradeBackgroundArgs{})
	go func() {
		m := libkb.NewMetaContextBackground(d.G())
		err := engine.RunEngine2(m, eng)
		if err != nil {
			m.CWarningf("per-user-key background upgrade error: %v", err)
		}
	}()

	d.G().PushShutdownHook(func() error {
		d.G().Log.Debug("stopping per-user-key background upgrade")
		eng.Shutdown()
		return nil
	})
}

func (d *Service) runBackgroundPerUserKeyUpkeep() {
	eng := engine.NewPerUserKeyUpkeepBackground(d.G(), &engine.PerUserKeyUpkeepBackgroundArgs{})
	go func() {
		m := libkb.NewMetaContextBackground(d.G())
		err := engine.RunEngine2(m, eng)
		if err != nil {
			m.CWarningf("per-user-key background upkeep error: %v", err)
		}
	}()

	d.G().PushShutdownHook(func() error {
		d.G().Log.Debug("stopping per-user-key background upkeep")
		eng.Shutdown()
		return nil
	})
}

func (d *Service) runBackgroundWalletInit() {
	eng := engine.NewWalletInitBackground(d.G(), &engine.WalletInitBackgroundArgs{})
	go func() {
		m := libkb.NewMetaContextBackground(d.G())
		err := engine.RunEngine2(m, eng)
		if err != nil {
			m.CWarningf("background WalletInit error: %v", err)
		}
	}()

	d.G().PushShutdownHook(func() error {
		d.G().Log.Debug("stopping background WalletInit")
		eng.Shutdown()
		return nil
	})
}

func (d *Service) runBackgroundWalletUpkeep() {
	eng := engine.NewWalletUpkeepBackground(d.G(), &engine.WalletUpkeepBackgroundArgs{})
	go func() {
		m := libkb.NewMetaContextBackground(d.G())
		err := engine.RunEngine2(m, eng)
		if err != nil {
			m.CWarningf("background WalletUpkeep error: %v", err)
		}
	}()

	d.G().PushShutdownHook(func() error {
		d.G().Log.Debug("stopping background WalletUpkeep")
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
		d.runTLFUpgrade()
		go d.identifySelf()
	}
	return nil
}

func (d *Service) OnLogout() (err error) {
	defer d.G().Trace("Service#OnLogout", func() error { return err })()
	log := func(s string) {
		d.G().Log.Debug("Service#OnLogout: %s", s)
	}

	log("cancelling live RPCs")
	d.G().RPCCanceller.CancelLiveContexts()

	log("shutting down chat modules")
	d.stopChatModules()

	log("shutting down gregor")
	if d.gregor != nil {
		d.gregor.Reset()
	}

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

	log("shutting down TLF upgrader")
	if d.tlfUpgrader != nil {
		d.tlfUpgrader.Shutdown()
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
	return d.gregor.Connect(uri)
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
	return d.lockPIDFile()
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
	// Short circuit if we're running under socket activation -- the socket
	// file is already set up for us, and we mustn't delete it.
	if systemd.IsSocketActivated() {
		return nil
	}
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
		return err
	}
	if err = libkb.MakeParentDirs(d.G().Log, fn); err != nil {
		return err
	}
	d.lockPid = libkb.NewLockPIDFile(d.G(), fn)
	if err = d.lockPid.Lock(); err != nil {
		return err
	}
	d.G().Log.Debug("Lock pidfile: %s\n", fn)
	return nil
}

func (d *Service) ConfigRPCServer() (net.Listener, error) {
	// First, check to see if we've been launched with socket activation by
	// systemd. If so, the socket is already open. Otherwise open it ourselves.
	// NOTE: We no longer configure our keybse.service and kbfs.service units
	// to be socket-activated by default. It was causing too much trouble when
	// non-systemd instances deleted the socket files. It's possible this issue
	// will get fixed in future versions of systemd; see
	// https://github.com/systemd/systemd/issues/7274.
	listener, err := systemd.GetListenerFromEnvironment()
	if err != nil {
		d.G().Log.Error("unexpected error in GetListenerFromEnvironment: %#v", err)
		return nil, err
	} else if listener != nil {
		d.G().Log.Debug("Systemd socket activation in use. Accepting connections on fd 3.")
	} else {
		d.G().Log.Debug("No socket activation in the environment. Binding to a new socket.")
		listener, err = d.G().BindToSocket()
		if err != nil {
			return nil, err
		}
	}

	if d.startCh != nil {
		close(d.startCh)
		d.startCh = nil
	}
	return listener, nil
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
	return d.gregor.DismissItem(context.Background(), gregor1.IncomingClient{Cli: d.gregor.cli}, id)
}

func (d *Service) GregorInject(cat string, body []byte) (gregor.MsgID, error) {
	if d.gregor == nil {
		return nil, errors.New("can't gregor inject without a gregor")
	}
	return d.gregor.InjectItem(context.TODO(), cat, body, gregor1.TimeOrOffset{})
}

func (d *Service) GregorInjectOutOfBandMessage(sys string, body []byte) error {
	if d.gregor == nil {
		return errors.New("can't gregor inject without a gregor")
	}
	return d.gregor.InjectOutOfBandMessage(context.TODO(), sys, body)
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

// tryLogin should only be called once.
var tryLoginOnce sync.Once

// tryLogin runs LoginOffline which will load the local session file and unlock the
// local device keys without making any network requests.
//
// If that fails for any reason, LoginProvisionedDevice is used, which should get
// around any issue where the session.json file is out of date or missing since the
// last time the service started.
func (d *Service) tryLogin(ctx context.Context) {
	tryLoginOnce.Do(func() {
		eng := engine.NewLoginOffline(d.G())
		m := libkb.NewMetaContext(ctx, d.G())
		if err := engine.RunEngine2(m, eng); err != nil {
			m.CDebugf("error running LoginOffline on service startup: %s", err)
			m.CDebugf("trying LoginProvisionedDevice")

			// Standalone mode quirk here. We call tryLogin when client is
			// launched in standalone to unlock the same keys that we would
			// have in service mode. But NewLoginProvisionedDevice engine
			// needs KbKeyrings and not every command sets it up. Ensure
			// Keyring is available.

			// TODO: We will be phasing out KbKeyrings usage flag, or even
			// usage flags entirely. Then this will not be needed because
			// Keyrings will always be loaded.

			if m.G().Keyrings == nil {
				m.CDebugf("tryLogin: Configuring Keyrings")
				m.G().ConfigureKeyring()
			}

			deng := engine.NewLoginProvisionedDevice(d.G(), "")
			deng.SecretStoreOnly = true
			if err := engine.RunEngine2(m, deng); err != nil {
				m.CDebugf("error running LoginProvisionedDevice on service startup: %s", err)
			}
		} else {
			m.CDebugf("success running LoginOffline on service startup")
		}
	})
}

func (d *Service) startProfile() {
	cpu := os.Getenv("KEYBASE_CPUPROFILE")
	if cpu != "" {
		f, err := os.Create(cpu)
		if err != nil {
			d.G().Log.Warning("error creating cpu profile: %s", err)
		} else {
			d.G().Log.Debug("+ starting service cpu profile in %s", cpu)
			pprof.StartCPUProfile(f)
		}
	}

	tr := os.Getenv("KEYBASE_SVCTRACE")
	if tr != "" {
		f, err := os.Create(tr)
		if err != nil {
			d.G().Log.Warning("error creating service trace: %s", err)
		} else {
			d.G().Log.Debug("+ starting service trace: %s", tr)
			trace.Start(f)
		}
	}
}

func (d *Service) stopProfile() {
	if os.Getenv("KEYBASE_CPUPROFILE") != "" {
		d.G().Log.Debug("stopping cpu profile")
		pprof.StopCPUProfile()
	}

	if os.Getenv("KEYBASE_SVCTRACE") != "" {
		d.G().Log.Debug("stopping service execution trace")
		trace.Stop()
	}

	mem := os.Getenv("KEYBASE_MEMPROFILE")
	if mem == "" {
		return
	}
	f, err := os.Create(mem)
	if err != nil {
		d.G().Log.Warning("could not create memory profile: %s", err)
		return
	}
	defer f.Close()

	runtime.GC() // get up-to-date statistics
	if err := pprof.WriteHeapProfile(f); err != nil {
		d.G().Log.Warning("could not write memory profile: %s", err)
	}
	d.G().Log.Debug("wrote memory profile %s", mem)

	var mems runtime.MemStats
	runtime.ReadMemStats(&mems)
	d.G().Log.Debug("runtime mem alloc:   %v", mems.Alloc)
	d.G().Log.Debug("runtime total alloc: %v", mems.TotalAlloc)
	d.G().Log.Debug("runtime heap alloc:  %v", mems.HeapAlloc)
	d.G().Log.Debug("runtime heap sys:    %v", mems.HeapSys)
}

func (d *Service) StartStandaloneChat(g *libkb.GlobalContext) error {
	g.ConnectionManager = libkb.NewConnectionManager()
	g.NotifyRouter = libkb.NewNotifyRouter(g)

	d.createChatModules()
	d.startupGregor()
	d.startChatModules()

	return nil
}

// Called by CtlHandler after DbNuke finishes and succeeds.
func (d *Service) onDbNuke(ctx context.Context) {
	d.avatarLoader.OnCacheCleared(libkb.NewMetaContext(ctx, d.G()))
}
