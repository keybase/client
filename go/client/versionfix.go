// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"io/ioutil"
	"net"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/blang/semver"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
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
	srv := rpc.NewServer(xp, libkb.WrapError)
	gcli := rpc.NewClient(xp, libkb.ErrorUnwrapper{}, nil)
	cli = keybase1.ConfigClient{Cli: gcli}
	srv.Register(NewLogUIProtocol())

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

	if serviceConfig.ForkType == keybase1.ForkType_AUTO {
		g.Log.Info("Restarting service...")
		_, err = AutoForkServer(g, cl)
	}

	return err
}
