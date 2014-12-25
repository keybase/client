package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libcmdline"
	"github.com/keybase/go-libkb"
	"github.com/keybase/protocol/go"
	fmprpc "github.com/maxtaco/go-framed-msgpack-rpc"
	"github.com/ugorji/go/codec"
	"net"
	"net/rpc"
	"os"
)

// Keep this around to simplify things
var G = &libkb.G

type Daemon struct {
}

func RegisterProtocols(server *rpc.Server, c net.Conn) {
	keybase_1.RegisterSignup(server, SignupHandler{c})
	keybase_1.RegisterConfig(server, ConfigHandler{c})
	keybase_1.RegisterLogin(server, LoginHandler{c})
}

func (d *Daemon) Handle(c net.Conn) {
	server := rpc.NewServer()
	RegisterProtocols(server, c)
	var mh codec.MsgpackHandle
	rpcCodec := fmprpc.MsgpackSpecRpc.ServerCodec(c, &mh, true)
	server.ServeCodec(rpcCodec)
}

func (d *Daemon) RunClient() (err error) {
	return fmt.Errorf("can't run daemon in client mode")
}

func (d *Daemon) Run() (err error) {
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
