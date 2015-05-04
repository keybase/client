package service

import (
	"fmt"
	"net"
	"os"

	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// Keep this around to simplify things
var G = libkb.G

type Service struct {
	chdirTo string
	lockPid *libkb.LockPIDFile
}

func NewService(d bool) *Service {
	return &Service{}
}

func RegisterProtocols(srv *rpc2.Server, xp *rpc2.Transport) {
	srv.Register(keybase1.BTCProtocol(NewBTCHandler(xp)))
	srv.Register(keybase1.ConfigProtocol(ConfigHandler{xp}))
	srv.Register(keybase1.CtlProtocol(CtlHandler{}))
	srv.Register(keybase1.DeviceProtocol(NewDeviceHandler(xp)))
	srv.Register(keybase1.DoctorProtocol(NewDoctorHandler(xp)))
	srv.Register(keybase1.IdentifyProtocol(NewIdentifyHandler(xp)))
	srv.Register(keybase1.LoginProtocol(NewLoginHandler(xp)))
	srv.Register(keybase1.ProveProtocol(NewProveHandler(xp)))
	srv.Register(keybase1.SessionProtocol(NewSessionHandler(xp)))
	srv.Register(keybase1.SignupProtocol(NewSignupHandler(xp)))
	srv.Register(keybase1.SigsProtocol(NewSigsHandler(xp)))
	srv.Register(keybase1.PgpProtocol(NewPGPHandler(xp)))
	srv.Register(keybase1.RevokeProtocol(NewRevokeHandler(xp)))
	srv.Register(keybase1.TrackProtocol(NewTrackHandler(xp)))
	srv.Register(keybase1.UserProtocol(NewUserHandler(xp)))
}

func (d *Service) Handle(c net.Conn) {
	xp := rpc2.NewTransport(c, libkb.NewRpcLogFactory(), libkb.WrapError)
	server := rpc2.NewServer(xp, libkb.WrapError)
	RegisterProtocols(server, xp)
	server.Run(true)
}

func (d *Service) RunClient() (err error) {
	return fmt.Errorf("can't run service in client mode")
}

func (d *Service) Run() (err error) {
	G.Service = true

	if len(d.chdirTo) != 0 {
		e_tmp := os.Chdir(d.chdirTo)
		if e_tmp != nil {
			G.Log.Warning("Could not change directory to %s: %s",
				d.chdirTo, e_tmp.Error())
		} else {
			G.Log.Info("Changing runtime dir to %s", d.chdirTo)
		}
	}

	if err = d.GetExclusiveLock(); err != nil {
		return
	}
	if err = d.OpenSocket(); err != nil {
		return
	}
	if err = d.ConfigRpcServer(); err != nil {
		return
	}
	if err = d.ListenLoop(); err != nil {
		return
	}
	return
}

func (d *Service) ReleaseLock() error {
	return d.lockPid.Close()
}

func (d *Service) GetExclusiveLock() error {
	dir, err := G.Env.GetRuntimeDir()
	if err != nil {
		return err
	}
	if err = os.MkdirAll(dir, libkb.PERM_DIR); err != nil {
		return err
	}
	if err := d.lockPIDFile(); err != nil {
		return err
	}
	return nil
}

func (d *Service) OpenSocket() error {
	sf, err := G.Env.GetSocketFile()
	if err != nil {
		return err
	}
	if exists, err := libkb.FileExists(sf); err != nil {
		return err
	} else if exists {
		G.Log.Debug("removing stale socket file: %s", sf)
		if err = os.Remove(sf); err != nil {
			G.Log.Warning("error removing stale socket file: %s", err)
			return err
		}
	}
	return nil
}

func (d *Service) lockPIDFile() (err error) {
	var fn string
	if fn, err = G.Env.GetPidFile(); err != nil {
		return
	}
	d.lockPid = libkb.NewLockPIDFile(fn)
	if err = d.lockPid.Lock(); err != nil {
		return fmt.Errorf("error locking %s: server already running", fn)
	}
	G.Log.Debug("Locking pidfile %s\n", fn)
	return nil
}

func (d *Service) ConfigRpcServer() (err error) {
	return nil
}

func (d *Service) ListenLoop() (err error) {

	var l net.Listener
	if l, err = G.BindToSocket(); err != nil {
		return
	}
	G.PushShutdownHook(func() error {
		G.Log.Info("Closing socket")
		d.lockPid.Close()
		return l.Close()
	})
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

func NewCmdService(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "service",
		Usage:       "keybase service [--chdir <dir>]",
		Description: "run the keybase local service",
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "chdir",
				Usage: "specify where to run as a daemon (via chdir)",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&Service{}, "service", c)
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

func GetCommands(cl *libcmdline.CommandLine) []cli.Command {
	return []cli.Command{
		NewCmdService(cl),
	}
}
