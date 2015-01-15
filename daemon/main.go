package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go/libcmdline"
	"github.com/keybase/go/libkb"
	"github.com/keybase/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
	"io/ioutil"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// Keep this around to simplify things
var G = &libkb.G

type Daemon struct {
}

func RegisterProtocols(srv *rpc2.Server, xp *rpc2.Transport) {
	srv.Register(keybase_1.SignupProtocol(SignupHandler{xp}))
	srv.Register(keybase_1.ConfigProtocol(ConfigHandler{xp}))
	srv.Register(keybase_1.LoginProtocol(NewLoginHandler(xp)))
	srv.Register(keybase_1.IdentifyProtocol(NewIdentifyHandler(xp)))
	srv.Register(keybase_1.ProveProtocol(NewProveHandler(xp)))
	srv.Register(keybase_1.MykeyProtocol(NewMykeyHandler(xp)))
}

func (d *Daemon) Handle(c net.Conn) {
	xp := rpc2.NewTransport(c, libkb.NewRpcLogFactory(), libkb.WrapError)
	server := rpc2.NewServer(xp, libkb.WrapError)
	RegisterProtocols(server, xp)
	server.Run(true)
}

func (d *Daemon) RunClient() (err error) {
	return fmt.Errorf("can't run daemon in client mode")
}

func (d *Daemon) Run() (err error) {
	G.Daemon = true
	if err = d.checkPIDFile(); err != nil {
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

func (d *Daemon) pidFilename() string {
	dir, err := G.Env.GetRuntimeDir()
	if err != nil {
		dir = "/tmp"
	}
	return filepath.Join(dir, "keybased.pid")
}

func (d *Daemon) checkPIDFile() error {
	f, err := os.OpenFile(d.pidFilename(), os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0666)
	if err != nil {
		if !os.IsExist(err) {
			return err
		}

		// pid file exists
		running, err := d.checkRunning()
		if err != nil {
			return err
		}
		if running {
			return fmt.Errorf("daemon already running")
		}

		// pid not active, create/truncate pid file
		f, err = os.Create(d.pidFilename())
		if err != nil {
			return err
		}

		if sf, err := G.Env.GetSocketFile(); err == nil {
			G.Log.Debug("removing stale socket file: %s", sf)
			if err = os.Remove(sf); err != nil {
				G.Log.Warning("error removing stale socket file: %s", err)
			}
		}
	}
	defer f.Close()
	fmt.Fprintf(f, "%d", os.Getpid())
	G.Log.Debug("wrote pid %d => %s", os.Getpid(), d.pidFilename())
	G.PushShutdownHook(func() error {
		G.Log.Info("Removing pid file")
		return os.Remove(d.pidFilename())
	})
	return nil
}

// checkRunning determines if the pid specified in the pid file is active.
func (d *Daemon) checkRunning() (running bool, err error) {
	contents, err := ioutil.ReadFile(d.pidFilename())
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}
	rpid, err := strconv.Atoi(strings.TrimSpace(string(contents)))
	if err != nil {
		return false, err
	}
	return libkb.PidExists(rpid), nil
}

func (d *Daemon) ConfigRpcServer() (err error) {
	return nil
}

func (d *Daemon) ListenLoop() (err error) {

	var l net.Listener
	if l, err = G.BindToSocket(); err != nil {
		return
	}
	G.PushShutdownHook(func() error {
		G.Log.Info("Closing socket")
		return l.Close()
	})
	for {
		var c net.Conn
		if c, err = l.Accept(); err != nil {
			return
		}
		go d.Handle(c)

	}
	return nil
}

func (v *Daemon) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (d *Daemon) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		KbKeyring:  true,
		GpgKeyring: true,
		API:        true,
		Socket:     true,
	}
}

func parseArgs() (libkb.CommandLine, libcmdline.Command, error) {

	cl := libcmdline.NewCommandLine(false)
	cl.SetDefaultCommand("daemon", &Daemon{})

	cmd, err := cl.Parse(os.Args)
	if err != nil {
		err = fmt.Errorf("Error parsing command line arguments: %s\n", err.Error())
		return nil, nil, err
	}
	return cl, cmd, nil
}

func main() {
	libcmdline.Main(parseArgs, nil, false)
}
