package main

import (
	"fmt"
	"os"
	"os/signal"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/service"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// Keep this around to simplify things
var G = libkb.G

var cmd libcmdline.Command

type Canceler interface {
	Cancel() error
}

func main() {

	g := G
	g.Init()

	go HandleSignals()
	err := mainInner(g)
	e2 := g.Shutdown()
	if err == nil {
		err = e2
	}
	if err != nil {
		g.Log.Error(err.Error())
		os.Exit(2)
	}
}

func mainInner(g *libkb.GlobalContext) error {

	cl := libcmdline.NewCommandLine(true, client.GetExtraFlags())
	cl.AddCommands(client.GetCommands(cl))
	cl.AddCommands(service.GetCommands(cl))

	var err error
	cmd, err = cl.Parse(os.Args)
	if err != nil {
		err = fmt.Errorf("Error parsing command line arguments: %s\n", err)
		return err
	}

	if cmd == nil {
		err = fmt.Errorf("No command selected")
		return err
	}

	if !cl.IsService() {
		client.InitUI()
	}

	if err = g.ConfigureAll(cl, cmd); err != nil {
		return err
	}

	if cl.IsService() {
		return cmd.Run()
	}

	// Start the server on the other end, possibly.
	// There are two cases in which we do this: (1) we want
	// a local loopback server in standalone mode; (2) we
	// need to "autofork" it. Do at most one of these
	// operations.
	if g.Env.GetStandalone() {
		if cl.IsNoStandalone() {
			return fmt.Errorf("Can't run command in standalone mode")
		}
		service.NewService(false /* isDaemon */).StartLoopbackServer(g)
	} else {
		// If this command warrants an autofork, do it now.
		if fc := cl.GetForkCmd(); fc == libcmdline.ForceFork || (g.Env.GetAutoFork() && fc != libcmdline.NoFork) {
			if err = client.ForkServerNix(cl); err != nil {
				return err
			}
		}
		// Whether or not we autoforked, we're now running in client-server
		// mode (as opposed to standalone). Register a global LogUI so that
		// calls to G.Log() in the daemon can be copied to us. This is
		// something of a hack on the daemon side.
		protocols := []rpc2.Protocol{client.NewLogUIProtocol()}
		if err := client.RegisterProtocols(protocols); err != nil {
			return err
		}
		// Send our current debugging state, so that the server can avoid
		// sending us verbose logs when we don't want to read them.
		logLevel := keybase1.LogLevel_INFO
		if G.Env.GetDebug() {
			logLevel = keybase1.LogLevel_DEBUG
		}
		ctlClient, err := client.GetCtlClient()
		if err != nil {
			return err
		}
		ctlClient.SetLogLevel(logLevel)
	}

	return cmd.Run()
}

func HandleSignals() {
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt)
	for {
		s := <-c
		if s != nil {
			G.Log.Debug("trapped signal %v", s)

			// if the current command has a Cancel function, then call it:
			if canc, ok := cmd.(Canceler); ok {
				G.Log.Debug("canceling running command")
				if err := canc.Cancel(); err != nil {
					G.Log.Warning("error canceling command: %s", err)
				}
			}

			G.Log.Debug("calling shutdown")
			G.Shutdown()
			G.Log.Error("interrupted")
			os.Exit(3)
		}
	}
}
