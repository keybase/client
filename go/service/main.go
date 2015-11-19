// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"io"
	"net"
	"os"
	"path"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type Service struct {
	libkb.Contextified
	isDaemon bool
	chdirTo  string
	lockPid  *libkb.LockPIDFile
	ForkType keybase1.ForkType
	startCh  chan struct{}
	stopCh   chan keybase1.ExitCode
}

func NewService(g *libkb.GlobalContext, isDaemon bool) *Service {
	return &Service{
		Contextified: libkb.NewContextified(g),
		isDaemon:     isDaemon,
		startCh:      make(chan struct{}),
		stopCh:       make(chan keybase1.ExitCode),
	}
}

func (d *Service) GetStartChannel() <-chan struct{} {
	return d.startCh
}

func (d *Service) RegisterProtocols(srv *rpc.Server, xp rpc.Transporter, connID libkb.ConnectionID, g *libkb.GlobalContext) error {
	protocols := []rpc.Protocol{
		keybase1.AccountProtocol(NewAccountHandler(xp, g)),
		keybase1.BTCProtocol(NewBTCHandler(xp, g)),
		keybase1.ConfigProtocol(NewConfigHandler(xp, g, d)),
		keybase1.CryptoProtocol(NewCryptoHandler(xp, g)),
		keybase1.CtlProtocol(NewCtlHandler(xp, d, g)),
		keybase1.DebuggingProtocol(NewDebuggingHandler(xp)),
		keybase1.DeviceProtocol(NewDeviceHandler(xp, g)),
		keybase1.FavoriteProtocol(NewFavoriteHandler(xp, g)),
		keybase1.IdentifyProtocol(NewIdentifyHandler(xp, g)),
		keybase1.KbfsProtocol(NewKBFSHandler(xp, g)),
		keybase1.LoginProtocol(NewLoginHandler(xp, g)),
		keybase1.ProveProtocol(NewProveHandler(xp, g)),
		keybase1.SessionProtocol(NewSessionHandler(xp, g)),
		keybase1.SignupProtocol(NewSignupHandler(xp, g)),
		keybase1.SigsProtocol(NewSigsHandler(xp, g)),
		keybase1.PGPProtocol(NewPGPHandler(xp, g)),
		keybase1.RevokeProtocol(NewRevokeHandler(xp, g)),
		keybase1.TestProtocol(NewTestHandler(xp, g)),
		keybase1.TrackProtocol(NewTrackHandler(xp, g)),
		keybase1.UserProtocol(NewUserHandler(xp, g)),
		keybase1.NotifyCtlProtocol(NewNotifyCtlHandler(xp, connID, g)),
		keybase1.DelegateUiCtlProtocol(NewDelegateUICtlHandler(xp, connID, g)),
	}
	for _, proto := range protocols {
		if err := srv.Register(proto); err != nil {
			return err
		}
	}
	return nil
}

func (d *Service) Handle(c net.Conn) {
	xp := rpc.NewTransport(c, libkb.NewRPCLogFactory(), libkb.WrapError)

	server := rpc.NewServer(xp, libkb.WrapError)

	cl := make(chan error)
	server.AddCloseListener(cl)
	connID := d.G().NotifyRouter.AddConnection(xp, cl)

	if err := d.RegisterProtocols(server, xp, connID, d.G()); err != nil {
		d.G().Log.Warning("RegisterProtocols error: %s", err)
		return
	}

	if d.isDaemon {
		baseHandler := NewBaseHandler(xp)
		logUI := LogUI{sessionID: 0, cli: baseHandler.getLogUICli()}
		handle := d.G().Log.AddExternalLogger(&logUI)
		defer d.G().Log.RemoveExternalLogger(handle)
	}

	if err := server.Run(false /* bg */); err != nil {
		if err != io.EOF {
			d.G().Log.Warning("Run error: %s", err)
		}
	}
}

func (d *Service) Run() (err error) {

	defer func() {
		if d.startCh != nil {
			close(d.startCh)
		}
		d.G().Shutdown()
	}()

	d.G().Log.Debug("+ service starting up; forkType=%v", d.ForkType)

	// Sets this global context to "service" mode which will toggle a flag
	// and will also set in motion various go-routine based managers
	d.G().SetService()
	d.G().SetUIRouter(NewUIRouter(d.G()))

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

	if err = d.GetExclusiveLock(); err != nil {
		return
	}
	if err = d.OpenSocket(); err != nil {
		return
	}

	var l net.Listener
	if l, err = d.ConfigRPCServer(); err != nil {
		return
	}
	d.G().ExitCode, err = d.ListenLoopWithStopper(l)

	if err != nil {
		return
	}
	return
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
	runtimeDir, err := d.ensureRuntimeDir()
	if err != nil {
		return err
	}

	// Write runtime info file
	rtInfo := libkb.KeybaseServiceInfo(d.G())
	return rtInfo.WriteFile(path.Join(runtimeDir, "keybased.info"))
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

func (d *Service) OpenSocket() error {
	sf, err := d.G().Env.GetSocketFile()
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

	d.G().PushShutdownHook(func() error {
		return l.Close()
	})

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
