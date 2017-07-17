// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package main

import (
	"fmt"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/service"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

// Keep this around to simplify things
var G = libkb.G

var cmd libcmdline.Command

func handleQuickVersion() bool {
	if len(os.Args) == 3 && os.Args[1] == "version" && os.Args[2] == "-S" {
		fmt.Printf("%s\n", libkb.VersionString())
		return true
	}
	return false
}

func main() {
	err := libkb.SaferDLLLoading()

	// handle a Quick version query
	if handleQuickVersion() {
		return
	}

	g := G
	g.Init()

	// Set our panel of external services.
	g.SetServices(externals.GetServices())

	// Don't abort here. This should not happen on any known version of Windows, but
	// new MS platforms may create regressions.
	if err != nil {
		g.Log.Errorf("SaferDLLLoading error: %v", err.Error())
	}

	go HandleSignals()
	err = mainInner(g)

	if g.Env.GetDebug() {
		// hack to wait a little bit to receive all the log messages from the
		// service before shutting down in debug mode.
		time.Sleep(100 * time.Millisecond)
	}

	e2 := g.Shutdown()
	if err == nil {
		err = e2
	}
	if err != nil {
		// Note that logger.Error and logger.Errorf are the same, which causes problems
		// trying to print percent signs, which are used in environment variables
		// in Windows.
		// Had to change from Error to Errorf because of go vet because of:
		// https://github.com/golang/go/issues/6407
		g.Log.Errorf("%s", err.Error())
		if g.ExitCode == keybase1.ExitCode_OK {
			g.ExitCode = keybase1.ExitCode_NOTOK
		}
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

func checkSystemUser(log logger.Logger) {
	if isAdminUser, match, _ := libkb.IsSystemAdminUser(); isAdminUser {
		log.Errorf("Oops, you are trying to run as an admin user (%s). This isn't supported.", match)
		os.Exit(int(keybase1.ExitCode_NOTOK))
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

	checkSystemUser(g.Log)

	if !cl.IsService() {
		if logger.SaveConsoleMode() == nil {
			defer logger.RestoreConsoleMode()
		}
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

	err = cmd.Run()
	if !cl.IsService() && !cl.SkipOutOfDateCheck() {
		// Errors that come up in printing this warning are logged but ignored.
		client.PrintOutOfDateWarnings(g)
	}
	return err
}

// AutoFork? Standalone? ClientServer? Brew service?  This function deals with the
// various run configurations that we can run in.
func configureProcesses(g *libkb.GlobalContext, cl *libcmdline.CommandLine, cmd *libcmdline.Command) (err error) {

	g.Log.Debug("+ configureProcesses")
	defer func() {
		g.Log.Debug("- configureProcesses -> %v", err)
	}()

	// On Linux, the service configures its own autostart file. Otherwise, no
	// need to configure if we're a service.
	if cl.IsService() {
		g.Log.Debug("| in configureProcesses, is service")
		if runtime.GOOS == "linux" {
			g.Log.Debug("| calling AutoInstall")
			_, err := install.AutoInstall(g, "", false, 10*time.Second, g.Log)
			if err != nil {
				return err
			}
		}
		return nil
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
		svc := service.NewService(g, false /* isDaemon */)
		err = svc.SetupCriticalSubServices()
		if err != nil {
			return err
		}
		err = svc.StartLoopbackServer()
		if err != nil {
			return err
		}
		if pflerr, ok := err.(libkb.PIDFileLockError); ok {
			err = fmt.Errorf("Can't run in standalone mode with a service running (see %q)",
				pflerr.Filename)
			return err
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

	var newProc bool
	if libkb.IsBrewBuild {
		// If we're running in Brew mode, we might need to install ourselves as a persistent
		// service for future invocations of the command.
		newProc, err = install.AutoInstall(g, "", false, 10*time.Second, g.Log)
		if err != nil {
			return err
		}
	} else {
		// If this command warrants an autofork, do it now.
		if fc == libcmdline.ForceFork || g.Env.GetAutoFork() {
			newProc, err = client.AutoForkServer(g, cl)
			if err != nil {
				return err
			}
		}
	}

	// Restart the service if we see that it's out of date. It's important to do this
	// before we make any RPCs to the service --- for instance, before the logging
	// calls below. See the v1.0.8 update fiasco for more details. Also, only need
	// to do this if we didn't just start a new process.
	if !newProc {
		if err = client.FixVersionClash(g, cl); err != nil {
			return err
		}
	}

	g.Log.Debug("| After forks; newProc=%v", newProc)
	if err = configureLogging(g, cl); err != nil {
		return err
	}

	// This sends the client's PATH to the service so the service can update
	// its PATH if necessary. This is called after FixVersionClash(), which
	// happens above in configureProcesses().
	if err = configurePath(g, cl); err != nil {
		// Further note -- don't die here.  It could be we're calling this method
		// against an earlier version of the service that doesn't support it.
		// It's not critical that it succeed, so continue on.
		g.Log.Debug("Configure path failed: %v", err)
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

	protocols := []rpc.Protocol{client.NewLogUIProtocol()}
	if err := client.RegisterProtocolsWithContext(protocols, g); err != nil {
		return err
	}

	logLevel := keybase1.LogLevel_INFO
	if g.Env.GetDebug() {
		logLevel = keybase1.LogLevel_DEBUG
	}
	logClient, err := client.GetLogClient(g)
	if err != nil {
		return err
	}
	arg := keybase1.RegisterLoggerArg{
		Name:  "CLI client",
		Level: logLevel,
	}
	if err := logClient.RegisterLogger(context.TODO(), arg); err != nil {
		g.Log.Warning("Failed to register as a logger: %s", err)
	}

	return nil
}

// configurePath sends the client's PATH to the service.
func configurePath(g *libkb.GlobalContext, cl *libcmdline.CommandLine) error {
	if cl.IsService() {
		// this only runs on the client
		return nil
	}

	return client.SendPath(g)
}

func HandleSignals() {
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM, os.Kill)
	for {
		s := <-c
		if s != nil {
			G.Log.Debug("trapped signal %v", s)

			// if the current command has a Stop function, then call it.
			// It will do its own stopping of the process and calling
			// shutdown
			if stop, ok := cmd.(client.Stopper); ok {
				G.Log.Debug("Stopping command cleanly via stopper")
				stop.Stop(keybase1.ExitCode_OK)
				return
			}

			// if the current command has a Cancel function, then call it:
			if canc, ok := cmd.(client.Canceler); ok {
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
