package service

import (
	"fmt"
	"io"
	"io/ioutil"
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
	startCh  chan struct{}
}

func NewService(isDaemon bool, g *libkb.GlobalContext) *Service {
	return &Service{
		Contextified: libkb.NewContextified(g),
		isDaemon:     isDaemon,
		startCh:      make(chan struct{}),
	}
}

func (d *Service) GetStartChannel() <-chan struct{} {
	return d.startCh
}

func RegisterProtocols(srv *rpc.Server, xp rpc.Transporter, connID libkb.ConnectionID, g *libkb.GlobalContext) error {
	protocols := []rpc.Protocol{
		keybase1.AccountProtocol(NewAccountHandler(xp, g)),
		keybase1.BTCProtocol(NewBTCHandler(xp, g)),
		keybase1.ConfigProtocol(NewConfigHandler(xp, g)),
		keybase1.CryptoProtocol(NewCryptoHandler(xp, g)),
		keybase1.CtlProtocol(NewCtlHandler(xp, g)),
		keybase1.DebuggingProtocol(NewDebuggingHandler(xp)),
		keybase1.DeviceProtocol(NewDeviceHandler(xp, g)),
		keybase1.DoctorProtocol(NewDoctorHandler(xp, g)),
		keybase1.FavoriteProtocol(NewFavoriteHandler(xp, g)),
		keybase1.IdentifyProtocol(NewIdentifyHandler(xp, g)),
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

	if err := RegisterProtocols(server, xp, connID, d.G()); err != nil {
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
	}()

	d.G().Service = true

	err = d.writeVersionFile()
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
	if err = d.ListenLoop(l); err != nil {
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

// If the daemon is already running, we need to be able to check what version
// it is, in case the client has been updated.
func (d *Service) writeVersionFile() error {
	// 0700 as per the XDG standard
	// TODO: It shouldn't be the responsibility of all callers to remember to
	// create these directories. They should be created transparently when
	// anything retrieves them.
	if err := os.MkdirAll(d.G().Env.GetRuntimeDir(), 0700); err != nil {
		return err
	}
	versionFilePath := path.Join(d.G().Env.GetRuntimeDir(), "service.version")
	version := fmt.Sprintf("%s-%s", libkb.Version, libkb.Build)
	return ioutil.WriteFile(versionFilePath, []byte(version), 0644)
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
	if err := os.MkdirAll(d.G().Env.GetRuntimeDir(), libkb.PermDir); err != nil {
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
	}

	d.G().PushShutdownHook(func() error {
		return l.Close()
	})

	return
}

func (d *Service) ListenLoop(l net.Listener) (err error) {
	for {
		var c net.Conn
		if c, err = l.Accept(); err != nil {
			return
		}
		go d.Handle(c)
	}
}

func (d *Service) ParseArgv(ctx *cli.Context) error {
	d.chdirTo = ctx.String("chdir")
	return nil
}

func NewCmdService(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "service",
		Usage: "Run the keybase service",
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "chdir",
				Usage: "Specify where to run as a daemon (via chdir)",
			},
			cli.StringFlag{
				Name:  "label",
				Usage: "Specifying a label can help identify services.",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewService(true /* isDaemon */, g), "service", c)
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
