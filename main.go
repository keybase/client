package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libcmdline"
	"github.com/keybase/go-libkb"
	"github.com/keybase/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
	"net"
	"os"
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
}

func (d *Daemon) Handle(c net.Conn) {
	xp := rpc2.NewTransport(c, libkb.NewRpcLogFactory())
	server := rpc2.NewServer(xp, libkb.WrapError)
	RegisterProtocols(server, xp)
	server.Run(true)
}

func (d *Daemon) RunClient() (err error) {
	return fmt.Errorf("can't run daemon in client mode")
}

func (d *Daemon) Run() (err error) {
	G.Daemon = true
	if err = d.ConfigRpcServer(); err != nil {
		return
	}
	if err = d.ListenLoop(); err != nil {
		return
	}
	return
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
