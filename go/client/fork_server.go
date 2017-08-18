// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"os"
	"os/exec"
	"time"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/service"
)

// GetExtraFlags gets the extra fork-related flags for this platform
func GetExtraFlags() []cli.Flag {
	return []cli.Flag{
		cli.BoolFlag{
			Name:  "auto-fork",
			Usage: "Enable auto-fork of background service.",
		},
		cli.BoolFlag{
			Name:  "no-auto-fork, F",
			Usage: "Disable auto-fork of background service.",
		},
	}
}

// AutoForkServer just forks the server and sets the autoFork flag to true
func AutoForkServer(g *libkb.GlobalContext, cl libkb.CommandLine) (bool, error) {
	return ForkServer(g, cl, keybase1.ForkType_AUTO)
}

// ForkServer forks a new background Keybase service, and waits until it's
// pingable. It will only do something useful on Unixes; it won't work on
// Windows (probably?). Returns an error if anything bad happens; otherwise,
// assume that the server was successfully started up. Returns (true, nil) if
// the server was actually forked, or (false, nil) if it was previously up.
func ForkServer(g *libkb.GlobalContext, cl libkb.CommandLine, forkType keybase1.ForkType) (bool, error) {
	srv := service.NewService(g, true /* isDaemon */)
	forked := false

	// If we try to get an exclusive lock and succeed, it means we
	// need to relaunch the daemon since it's dead
	g.Log.Debug("Getting flock")
	err := srv.GetExclusiveLockWithoutAutoUnlock()
	if err == nil {
		g.Log.Debug("Flocked! Server must have died")
		srv.ReleaseLock()
		_, err = spawnServer(g, cl, forkType)
		if err != nil {
			g.Log.Errorf("Error in spawning server process: %s", err)
			return false, err
		}
		err = pingLoop(g)
		if err != nil {
			g.Log.Errorf("Ping failure after server fork: %s", err)
			return false, err
		}
		forked = true
	} else {
		g.Log.Debug("The server is still up")
		err = nil
	}

	return forked, err
}

func pingLoop(g *libkb.GlobalContext) error {
	var err error
	for i := 0; i < 20; i++ {
		_, err = getSocketWithRetry(g)
		if err == nil {
			g.Log.Debug("Connected (%d)", i)
			return nil
		}
		g.Log.Debug("Failed to connect to socket (%d): %s", i, err)
		err = nil
		time.Sleep(200 * time.Millisecond)
	}
	return nil
}

func makeServerCommandLine(g *libkb.GlobalContext, cl libkb.CommandLine,
	forkType keybase1.ForkType) (arg0 string, args []string, err error) {
	// ForkExec requires an absolute path to the binary. LookPath() gets this
	// for us, or correctly leaves arg0 alone if it's already a path.
	arg0, err = exec.LookPath(os.Args[0])
	if err != nil {
		return
	}

	// Fixme: This isn't ideal, it would be better to specify when the args
	// are defined if they should be reexported to the server, and if so, then
	// we should automate the reconstruction of the argument vector.  Let's do
	// this when we yank out keybase/cli
	bools := []string{
		"no-debug",
		"api-dump-unsafe",
		"plain-logging",
	}

	strings := []string{
		"home",
		"server",
		"config",
		"session",
		"proxy",
		"username",
		"gpg-home",
		"gpg",
		"secret-keyring",
		"pid-file",
		"socket-file",
		"gpg-options",
		"local-rpc-debug-unsafe",
		"run-mode",
		"timers",
		"tor-mode",
		"tor-proxy",
		"tor-hidden-address",
	}
	args = append(args, arg0)

	// Always pass --debug to the server for more verbose logging, as other
	// startup mechanisms do (launchd, run_keybase, etc). This can be
	// overridden with --no-debug though.
	args = append(args, "--debug")

	for _, b := range bools {
		if isSet, isTrue := cl.GetBool(b, true); isSet && isTrue {
			args = append(args, "--"+b)
		}
	}

	for _, s := range strings {
		if v := cl.GetGString(s); len(v) > 0 {
			args = append(args, "--"+s, v)
		}
	}

	// If there is no explicit log file add one when autoforking.
	// otherwise it was added in the previous block already.
	if g.Env.GetLogFile() == "" {
		args = append(args, "--log-file", g.Env.GetDefaultLogFile())
	}

	args = append(args, "service")

	var chdir string
	chdir, err = G.Env.GetServiceSpawnDir()
	if err != nil {
		return
	}

	G.Log.Debug("| Setting run directory for keybase service to %s", chdir)
	args = append(args, "--chdir", chdir)

	if forkType == keybase1.ForkType_AUTO {
		args = append(args, "--auto-forked")
	} else if forkType == keybase1.ForkType_WATCHDOG {
		args = append(args, "--watchdog-forked")
	} else if forkType == keybase1.ForkType_LAUNCHD {
		args = append(args, "--launchd-forked")
	}

	G.Log.Debug("| Made server args: %s %v", arg0, args)

	return
}
