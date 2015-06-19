package main

import (
	"fmt"
	"os"
	"os/signal"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/service"
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

	if g.Env.GetStandalone() || cl.IsService() {
		err = cmd.Run()
	} else {
		// No sense in starting the daemon just to stop it
		fc := cl.GetForkCmd()
		if fc == libcmdline.ForceFork || (g.Env.GetAutoFork() && fc != libcmdline.NoFork) {
			if err = client.ForkServerNix(cl); err != nil {
				return err
			}
		}
		err = cmd.RunClient()
	}
	return err
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

			G.Shutdown()
			G.Log.Error("interrupted")
			os.Exit(3)
		}
	}
}
