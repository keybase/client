// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"io/ioutil"
	"net"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/blang/semver"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/status"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

func getPid(g *libkb.GlobalContext) (int, error) {
	fn, err := g.Env.GetPidFile()
	if err != nil {
		return -1, err
	}
	data, err := ioutil.ReadFile(fn)
	if err != nil {
		return -1, err
	}
	pidString := strings.TrimSpace(string(data))
	pid, err := strconv.ParseInt(pidString, 10, 64)
	if err != nil {
		return -1, err
	}
	return int(pid), nil
}

func killPid(pid int) error {
	if pid < 0 {
		return fmt.Errorf("invalid pid given to kill")
	}

	p, err := os.FindProcess(pid)
	if err != nil {
		return err
	}
	err = p.Signal(os.Kill)
	return err
}

func FixVersionClash(g *libkb.GlobalContext, cl libkb.CommandLine) (err error) {
	var cli keybase1.ConfigClient
	var ctlCli keybase1.CtlClient
	var serviceConfig keybase1.Config
	var socket net.Conn

	g.Log.Debug("+ FixVersionClash")
	defer func() {
		if socket != nil {
			socket.Close()
			socket = nil
		}
		g.Log.Debug("- FixVersionClash -> %v", err)
	}()

	// Make our own stack here, circumventing all of our libraries, so
	// as not to introduce any incompatibilities with earlier services
	// (like 1.0.8)
	socket, err = g.SocketInfo.DialSocket()
	if err != nil {
		g.Log.Debug("| Failed to DialSocket, but ignoring error: %s\n", err)
		return nil
	}
	xp := libkb.NewTransportFromSocket(g, socket)
	srv := rpc.NewServer(xp, libkb.MakeWrapError(g))
	gcli := rpc.NewClient(xp, libkb.NewContextifiedErrorUnwrapper(g), nil)
	cli = keybase1.ConfigClient{Cli: gcli}
	srv.Register(NewLogUIProtocol(g))

	serviceConfig, err = cli.GetConfig(context.TODO(), 0)
	if err != nil {
		return err
	}
	g.Log.Debug("| Contacted service; got version: %s", serviceConfig.Version)

	// We'll check and restart the service if there is a new version.
	var semverClient, semverService semver.Version

	cliVersion := libkb.VersionString()
	if g.Env.GetRunMode() == libkb.DevelRunMode {
		tmp := os.Getenv("KEYBASE_SET_VERSION")
		if len(tmp) > 0 {
			cliVersion = tmp
		}
	}

	semverClient, err = semver.Make(cliVersion)
	if err != nil {
		return err
	}
	semverService, err = semver.Make(serviceConfig.Version)
	if err != nil {
		return err
	}

	g.Log.Debug("| version check %s v %s", semverClient, semverService)
	if semverClient.EQ(semverService) {
		g.Log.Debug("| versions check out")
		return nil
	} else if semverClient.LT(semverService) && semverClient.Major < semverService.Major {
		return fmt.Errorf("Unexpected version clash; client is at v%s, which is significantly *less than* server at v%s",
			semverClient, semverService)
	}

	// There's a common situation in development where the service is running
	// from a production install under a watchdog/launchd/systemd, but the
	// client is a binary you just built from your GOPATH. In this case,
	// restarting the service (e.g. `systemctl --user restart keybase.service`)
	// isn't going to help. Detect that situation by comparing the paths of the
	// binaries involved, and print a warning instead of restarting. Note that
	// older services don't send the BinaryRealpath field, so we have to check
	// that it's not empty.
	clientRealpath, err := libkb.CurrentBinaryRealpath()
	if err != nil {
		g.Log.Warning("Failed to get current realpath: %s", err)
	} else if serviceConfig.BinaryRealpath != "" && serviceConfig.BinaryRealpath != clientRealpath {
		g.Log.Warning("Service is running v%s, while client is running v%s.",
			semverService, semverClient)
		g.Log.Warning("Skipping restart, because their paths differ:")
		g.Log.Warning("service: %s", serviceConfig.BinaryRealpath)
		g.Log.Warning(" client: %s", clientRealpath)
		return nil
	}

	g.Log.Warning("Restarting after upgrade; service is running v%s, while v%s is available",
		semverService, semverClient)

	origPid, err := getPid(g)
	if err != nil {
		g.Log.Warning("Failed to find pid for service: %v\n", err)
	}

	if serviceConfig.ForkType == keybase1.ForkType_LAUNCHD {
		return restartLaunchdService(g, serviceConfig.Label, g.Env.GetServiceInfoPath())
	}

	ctlCli = keybase1.CtlClient{Cli: gcli}
	err = ctlCli.Stop(context.TODO(), keybase1.StopArg{})
	if err != nil && origPid >= 0 {
		// A fallback approach. I haven't seen a need for it, but it can't really hurt.
		// If we fail to restart via Stop() then revert to kill techniques.

		g.Log.Warning("Error in Stopping %d via RPC: %v; trying fallback (kill via pidfile)", origPid, err)
		time.Sleep(time.Second)
		var newPid int
		newPid, err = getPid(g)
		if err != nil {
			g.Log.Warning("No pid; shutdown must have worked (%v)", err)
		} else if newPid != origPid {
			g.Log.Warning("New service found with pid=%d; assuming restart", newPid)
			return nil
		} else {
			if err = killPid(origPid); err != nil {
				g.Log.Warning("Kill via pidfile failed: %v\n", err)
				return err
			}
			g.Log.Warning("Successful kill() on pid=%d", origPid)
		}
	}

	socket.Close()
	socket = nil

	time.Sleep(10 * time.Millisecond)
	g.Log.Debug("Waiting for shutdown...")
	time.Sleep(1 * time.Second)

	if serviceConfig.ForkType == keybase1.ForkType_AUTO || serviceConfig.ForkType == keybase1.ForkType_SYSTEMD {
		g.Log.Info("Restarting service...")
		_, err = AutoForkServer(g, cl)
	}

	return err
}

func WarnOutdatedKBFS(g *libkb.GlobalContext, cl libkb.CommandLine) (err error) {
	cli, err := GetConfigClient(g)
	if err != nil {
		return err
	}

	clientStatus, err := cli.GetClientStatus(context.TODO(), 0)
	if err != nil {
		return err
	}
	var kbfsClientVersion string

	kbfs := status.GetFirstClient(clientStatus, keybase1.ClientType_KBFS)
	if kbfs == nil {
		g.Log.Debug("| KBFS not running; skip KBFS version check")
		return nil
	}

	kbfsClientVersion = kbfs.Version
	kbfsInstalledVersion, err := install.KBFSBundleVersion(g, "")
	if err != nil {
		return err
	}

	g.Log.Debug("| KBFS version check installed=%s v. client=%s", kbfsInstalledVersion, kbfsClientVersion)
	kbfsClientSemver, err := semver.Make(kbfsClientVersion)
	if err != nil {
		return err
	}

	kbfsInstalledSemver, err := semver.Make(kbfsInstalledVersion)
	if err != nil {
		return err
	}

	if kbfsClientSemver.GT(kbfsInstalledSemver) {
		g.Log.Debug("| KBFS client version greater than installed")
	} else if kbfsClientSemver.EQ(kbfsInstalledSemver) {
		g.Log.Debug("| KBFS versions check out")
	} else if kbfsClientSemver.Major < kbfsInstalledSemver.Major {
		return fmt.Errorf("Unexpected KBFS version clash; client is at v%s, which is significantly *less than* installed at v%s",
			kbfsClientSemver, kbfsInstalledSemver)
	} else {
		g.Log.Warning("KBFS needs to restart; running version %s, but %s installed.", kbfsClientSemver, kbfsInstalledSemver)
		if runtime.GOOS == "linux" {
			mountDir, err := g.Env.GetMountDir()
			g.Log.Debug("| KBFS mountdir %s", mountDir)
			if err != nil {
				return err
			}
			processes, err := install.LsofMount(mountDir, g.Log)
			g.Log.Debug("| KBFS lsof err=%s", err)
			g.Log.Debug("| KBFS lsof processes=%v", processes)
			if err != nil || len(processes) == 0 {
				g.Log.Warning("Run 'run_keybase' to restart Keybase services.")
			} else {
				g.Log.Warning("KBFS currently in use by the following processes:")
				for _, process := range processes {
					g.Log.Warning("- pid=%s, cmd=%s", process.PID, process.Command)
				}
				g.Log.Warning("Please terminate the above processes and then run 'run_keybase' to restart Keybase services safely.")
			}
		}
	}

	return nil
}
