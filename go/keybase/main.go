// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package main

import (
	"fmt"
	"os"
	"os/signal"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/client/go/service"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
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
	}
	if g.ExitCode != keybase1.ExitCode_OK {
		os.Exit(int(g.ExitCode))
	}
}

func warnNonProd(log logger.Logger, e *libkb.Env) {
	mode := e.GetRunMode()
	if mode != libkb.ProductionRunMode {
		log.Warning("Running in %s mode", mode)
	}
}

func mainInner(g *libkb.GlobalContext) error {
	cl := libcmdline.NewCommandLine(true, client.GetExtraFlags())
	cl.AddCommands(client.GetCommands(cl, g))
	cl.AddCommands(service.GetCommands(cl, g))
	cl.AddHelpTopics(client.GetHelpTopics())

	var err error
	cmd, err = cl.Parse(os.Args)
	if err != nil {
		err = fmt.Errorf("Error parsing command line arguments: %s\n", err)
		return err
	}

	if cmd == nil {
		return nil
	}

	if !cl.IsService() {
		client.InitUI()
	}

	if err = g.ConfigureCommand(cl, cmd); err != nil {
		return err
	}
	g.StartupMessage()

	warnNonProd(g.Log, g.Env)

	if err = configureProcesses(g, cl, &cmd); err != nil {
		return err
	}

	return cmd.Run()
}

// AutoFork? Standalone? ClientServer? Brew service?  This function deals with the
// various run configurations that we can run in.
func configureProcesses(g *libkb.GlobalContext, cl *libcmdline.CommandLine, cmd *libcmdline.Command) (err error) {

	g.Log.Debug("+ configureProcesses")
	defer func() {
		g.Log.Debug("- configureProcesses -> %v", err)
	}()

	// No need to configure if we're a service
	if cl.IsService() {
		return err
	}

	// Start the server on the other end, possibly.
	// There are two cases in which we do this: (1) we want
	// a local loopback server in standalone mode; (2) we
	// need to "autofork" it. Do at most one of these
	// operations.
	if g.Env.GetStandalone() {
		if cl.IsNoStandalone() {
			err = fmt.Errorf("Can't run command in standalone mode")
			return err
		}
		err := service.NewService(g, false /* isDaemon */).StartLoopbackServer()
		if err != nil {
			if pflerr, ok := err.(libkb.PIDFileLockError); ok {
				err = fmt.Errorf("Can't run in standalone mode with a service running (see %q)",
					pflerr.Filename)
				return err
			}
		}
		return err
	}

	// After this point, we need to provide a remote logging story if necessary

	// If this command specifically asks not to be forked, then we are done in this
	// function. This sort of thing is true for the `ctl` commands and also the `version`
	// command.
	fc := cl.GetForkCmd()
	if fc == libcmdline.NoFork {
		return configureLogging(g, cl)
	}

	// If this command warrants an autofork, do it now.
	var newProc bool
	if fc == libcmdline.ForceFork || g.Env.GetAutoFork() {
		newProc, err = client.AutoForkServer(g, cl)
		if err != nil {
			return err
		}
	} else if libkb.IsBrewBuild {
		// If we're running in Brew mode, we might need to install ourselves as a persistent
		// service for future invocations of the command.
		newProc, err = client.AutoInstall(g, "", false)
		if err != nil {
			return err
		}
	}

	g.Log.Debug("| After forks; newProc=%v", newProc)
	if err = configureLogging(g, cl); err != nil {
		return err
	}

	// If we have created a new proc, then there's no need to keep going to the
	// final step, which is to check for a version clashes.
	if newProc {
		return nil
	}

	// Finally, we'll restart the service if we see that it's out of date.
	if err = client.FixVersionClash(g, cl); err != nil {
		return err
	}

	return nil
}

func configureLogging(g *libkb.GlobalContext, cl *libcmdline.CommandLine) error {

	g.Log.Debug("+ configureLogging")
	defer func() {
		g.Log.Debug("- configureLogging")
	}()
	// Whether or not we autoforked, we're now running in client-server
	// mode (as opposed to standalone). Register a global LogUI so that
	// calls to G.Log() in the daemon can be copied to us. This is
	// something of a hack on the daemon side.
	if !g.Env.GetDoLogForward() || cl.GetLogForward() == libcmdline.LogForwardNone {
		g.Log.Debug("Disabling log forwarding")
		return nil
	}

	// TODO This triggers a connection to the RPC server before cmd.Run() is
	// called, so the command has no way to deal with errors on its own.
	// This should probably be moved into RegisterProtocols?
	// Also rpc.RegisterProtocolsWithContext seems to automatically add the
	// LogUIProtocol?
	return registerGlobalLogUI(g)
}

func registerGlobalLogUI(g *libkb.GlobalContext) error {
	protocols := []rpc.Protocol{client.NewLogUIProtocol()}
	if err := client.RegisterProtocols(protocols); err != nil {
		return err
	}
	// Send our current debugging state, so that the server can avoid
	// sending us verbose logs when we don't want to read them.
	logLevel := keybase1.LogLevel_INFO
	if g.Env.GetDebug() {
		logLevel = keybase1.LogLevel_DEBUG
	}
	ctlClient, err := client.GetCtlClient(g)
	if err != nil {
		return err
	}
	g.Log.Debug("Setting remote log level: %v", logLevel)
	arg := keybase1.SetLogLevelArg{Level: logLevel}
	ctlClient.SetLogLevel(context.TODO(), arg)
	return nil
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
