// +build darwin dragonfly freebsd linux netbsd openbsd solaris

package client

import (
	"fmt"
	"os"
	"os/exec"
	"syscall"
	"time"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/service"
)

// GetExtraFlags gets the extra fork-related flags for this platform
func GetExtraFlags() []cli.Flag {
	return []cli.Flag{
		cli.BoolFlag{
			Name:  "no-auto-fork, F",
			Usage: "Disable auto-fork of background service.",
		},
		cli.BoolFlag{
			Name:  "auto-fork",
			Usage: "Enable auto-fork of background service.",
		},
	}
}

// ForkServerNix forks a new background Keybase service, and waits until it's
// pingable. It will only do something useful on Unixes; it won't work on
// Windows (probably?). Returns an error if anything bad happens; otherwise,
// assume that the server was successfully started up.
func ForkServerNix(cl libkb.CommandLine, g *libkb.GlobalContext) error {
	srv := service.NewService(true /* isDaemon */, g)

	// If we try to get an exclusive lock and succeed, it means we
	// need to relaunch the daemon since it's dead
	g.Log.Debug("Getting flock")
	err := srv.GetExclusiveLockWithoutAutoUnlock()
	if err == nil {
		g.Log.Debug("Flocked! Server must have died")
		srv.ReleaseLock()
		err = spawnServer(cl)
		if err != nil {
			g.Log.Errorf("Error in spawning server process: %s", err)
			return err
		}
		err = pingLoop()
		if err != nil {
			g.Log.Errorf("Ping failure after server fork: %s", err)
			return err
		}
	} else {
		g.Log.Debug("The server is still up")
		err = nil
	}

	return err
}

func pingLoop() error {
	var err error
	for i := 0; i < 10; i++ {
		_, _, err = G.GetSocket(true)
		if err == nil {
			G.Log.Debug("Connected (%d)", i)
			return nil
		}
		G.Log.Debug("Failed to connect to socket (%d): %s", i, err)
		err = nil
		time.Sleep(200 * time.Millisecond)
	}
	return nil
}

func makeServerCommandLine(cl libkb.CommandLine) (arg0 string, args []string, err error) {
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
		"debug",
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
	}
	args = append(args, arg0)

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

	args = append(args, "service")

	var chdir string
	chdir, err = G.Env.GetServiceSpawnDir()
	if err != nil {
		return
	}

	G.Log.Debug("| Setting run directory for keybase service to %s", chdir)
	args = append(args, "--chdir", chdir)

	G.Log.Debug("| Made server args: %s %v", arg0, args)

	return
}

func spawnServer(cl libkb.CommandLine) (err error) {

	var files []uintptr
	var cmd string
	var args []string
	var devnull, log *os.File
	var pid int

	defer func() {
		if err != nil {
			if devnull != nil {
				devnull.Close()
			}
			if log != nil {
				log.Close()
			}
		}
	}()

	if devnull, err = os.OpenFile("/dev/null", os.O_RDONLY, 0); err != nil {
		return
	}
	files = append(files, devnull.Fd())

	if G.Env.GetSplitLogOutput() {
		files = append(files, uintptr(1), uintptr(2))
	} else {
		if _, log, err = libkb.OpenLogFile(); err != nil {
			return
		}
		files = append(files, log.Fd(), log.Fd())
	}

	attr := syscall.ProcAttr{
		Env:   os.Environ(),
		Sys:   &syscall.SysProcAttr{Setsid: true},
		Files: files,
	}

	cmd, args, err = makeServerCommandLine(cl)
	if err != nil {
		return err
	}

	pid, err = syscall.ForkExec(cmd, args, &attr)
	if err != nil {
		err = fmt.Errorf("Error in ForkExec: %s", err)
	} else {
		G.Log.Info("Forking background server with pid=%d", pid)
	}
	return err
}
