package service

import (
	"fmt"
	"io/ioutil"
	"net"
	"os"
	"path"

	"github.com/keybase/cli"
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

func RegisterProtocols(srv *rpc2.Server, xp *rpc2.Transport) error {
	protocols := []rpc2.Protocol{
		keybase1.AccountProtocol(NewAccountHandler(xp)),
		keybase1.BTCProtocol(NewBTCHandler(xp)),
		keybase1.ConfigProtocol(ConfigHandler{xp}),
		keybase1.CryptoProtocol(NewCryptoHandler(xp)),
		keybase1.CtlProtocol(CtlHandler{}),
		keybase1.DeviceProtocol(NewDeviceHandler(xp)),
		keybase1.DoctorProtocol(NewDoctorHandler(xp)),
		keybase1.FavoriteProtocol(NewFavoriteHandler(xp)),
		keybase1.IdentifyProtocol(NewIdentifyHandler(xp)),
		keybase1.LoginProtocol(NewLoginHandler(xp)),
		keybase1.ProveProtocol(NewProveHandler(xp)),
		keybase1.SessionProtocol(NewSessionHandler(xp)),
		keybase1.SignupProtocol(NewSignupHandler(xp)),
		keybase1.SigsProtocol(NewSigsHandler(xp)),
		keybase1.PGPProtocol(NewPGPHandler(xp)),
		keybase1.RevokeProtocol(NewRevokeHandler(xp)),
		keybase1.TrackProtocol(NewTrackHandler(xp)),
		keybase1.UserProtocol(NewUserHandler(xp)),
	}
	for _, proto := range protocols {
		if err := srv.Register(proto); err != nil {
			return err
		}
	}
	return nil
}

func (d *Service) Handle(c net.Conn) {
	xp := rpc2.NewTransport(c, libkb.NewRPCLogFactory(), libkb.WrapError)

	server := rpc2.NewServer(xp, libkb.WrapError)
	if err := RegisterProtocols(server, xp); err != nil {
		G.Log.Warning("RegisterProtocols error: %s", err)
		return
	}
	if err := server.Run(true); err != nil {
		G.Log.Warning("Run error: %s", err)
	}
}

func (d *Service) RunClient() (err error) {
	G.Service = true

	err = d.writeVersionFile()
	if err != nil {
		return
	}

	if len(d.chdirTo) != 0 {
		etmp := os.Chdir(d.chdirTo)
		if etmp != nil {
			G.Log.Warning("Could not change directory to %s: %s", d.chdirTo, etmp)
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

	var l net.Listener
	if l, err = d.ConfigRPCServer(); err != nil {
		return
	}
	if err = d.ListenLoop(l); err != nil {
		return
	}
	return
}

func (d *Service) StartLoopbackServer(g *libkb.GlobalContext) error {

	var l net.Listener
	var err error

	if l, err = g.MakeLoopbackServer(); err != nil {
		return err
	}

	go d.ListenLoop(l)

	return nil
}

// If the daemon is already running, we need to be able to check what version
// it is, in case the client has been updated.
func (d *Service) writeVersionFile() error {
	// 0700 as per the XDG standard
	if err := os.MkdirAll(G.Env.GetCacheDir(), 0700); err != nil {
		return err
	}
	versionFilePath := path.Join(G.Env.GetCacheDir(), "service.version")
	return ioutil.WriteFile(versionFilePath, []byte(libkb.Version), 0644)
}

func (d *Service) ReleaseLock() error {
	return d.lockPid.Close()
}

func (d *Service) GetExclusiveLock() error {
	dir, err := G.Env.GetRuntimeDir()
	if err != nil {
		return err
	}
	if err = os.MkdirAll(dir, libkb.PermDir); err != nil {
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

func (d *Service) ConfigRPCServer() (l net.Listener, err error) {
	if l, err = G.BindToSocket(); err != nil {
		return
	}

	G.PushShutdownHook(func() error {
		G.Log.Info("Closing socket")
		if err := d.lockPid.Close(); err != nil {
			G.Log.Warning("error closing lock pid file: %s", err)
		}
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
