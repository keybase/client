// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"path"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdNStatus(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "nstatus",
		Usage: "Show information about current user",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdNStatus{Contextified: libkb.NewContextified(g)}, "nstatus", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "j, json",
				Usage: "Output status as JSON",
			},
		},
	}
}

type CmdNStatus struct {
	libkb.Contextified
	json bool
}

func (c *CmdNStatus) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 0 {
		return UnexpectedArgsError("status")
	}
	c.json = ctx.Bool("json")
	return nil
}

type fstatus struct {
	Username               string
	UserID                 string
	DeviceID               string
	DeviceName             string
	DeviceStatus           string
	LoggedInProvisioned    bool `json:"LoggedIn"`
	PassphraseStreamCached bool `json:"KeychainUnlocked"`
	ConfigPath             string

	Client struct {
		Version string
	}
	Service struct {
		Version string
		Running bool
		Pid     string
		Log     string
	}
	KBFS struct {
		Version string
		Running bool
		Pid     string
		Log     string
	}
	Desktop struct {
		Running bool
	}
}

func (c *CmdNStatus) Run() error {
	status, err := c.load()
	if err != nil {
		return err
	}

	return c.output(status)
}

func (c *CmdNStatus) load() (*fstatus, error) {
	var status fstatus

	status.Client.Version = libkb.VersionString()

	cli, err := GetConfigClient(c.G())
	if err != nil {
		return nil, err
	}

	curStatus, err := cli.GetCurrentStatus(context.TODO(), 0)
	if err != nil {
		return nil, err
	}

	status.LoggedInProvisioned = curStatus.LoggedIn
	if curStatus.User != nil {
		status.Username = curStatus.User.Username
		status.UserID = curStatus.User.Uid.String()
	}

	extStatus, err := cli.GetExtendedStatus(context.TODO(), 0)
	if err != nil {
		return nil, err
	}

	config, err := cli.GetConfig(context.TODO(), 0)
	if err != nil {
		return nil, err
	}

	status.ConfigPath = config.ConfigPath
	status.Service.Version = config.Version

	status.DeviceID = extStatus.DeviceID.String()
	status.DeviceName = extStatus.DeviceName
	status.DeviceStatus = extStatus.DeviceStatus

	if extStatus.Standalone {
		status.Service.Running = false
	} else {
		status.Service.Running = true
		status.Service.Log = path.Join(extStatus.LogDir, c.serviceLogFilename())
	}

	status.PassphraseStreamCached = extStatus.PassphraseStreamCached

	kbfsVersion, err := install.KBFSBundleVersion(c.G(), "")
	if err == nil {
		status.KBFS.Version = kbfsVersion
	}
	status.KBFS.Log = path.Join(extStatus.LogDir, c.kbfsLogFilename())

	status.Desktop.Running = extStatus.DesktopUIConnected

	// set anything os-specific:
	if err := c.osSpecific(&status); err != nil {
		return nil, err
	}

	return &status, nil
}

func (c *CmdNStatus) output(status *fstatus) error {
	if c.json {
		return c.outputJSON(status)
	}

	return c.outputTerminal(status)
}

func (c *CmdNStatus) outputJSON(status *fstatus) error {
	b, err := json.MarshalIndent(status, "", "    ")
	if err != nil {
		return err
	}
	dui := c.G().UI.GetDumbOutputUI()
	_, err = dui.Printf(string(b) + "\n")
	return err
}

/*

Username: chris
Device name: ubuntu-work-vm
User ID: 23260c2ce19420f97b58d7d95b68ca00
Device ID: 829493463c83fd2560d1964948a6df18
Local Keybase Keychain:  unlocked
KBFS:
   status: running, connected, mounted
   version: 1.0.8-1123123213
   log:  /home/chris/.cache/keybase/keybase.kbfs.log
Service:
   status: running, connected
   version: 1.0.8-1123123213
   log:  /home/chris/.cache/keybase/keybase.log
Client:
   version: 1.0.8-12312321312
Electron:
   status: running

*/

/*

   logged out:

   available users:
    chris
        - whatever info
    max
        - whatever info

*/

func (c *CmdNStatus) outputTerminal(status *fstatus) error {
	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("Username:      %s\n", status.Username)
	dui.Printf("Logged in:     %s\n\n", c.boolString(status.LoggedInProvisioned, "yes", "no"))
	dui.Printf("Device name:   %s\n", status.DeviceName)
	dui.Printf("Device ID:     %s\n", status.DeviceID)
	dui.Printf("Device status: %s\n\n", status.DeviceStatus)
	dui.Printf("Local Keybase Keychain: %s\n", c.boolString(status.PassphraseStreamCached, "unlocked", "locked"))
	dui.Printf("\nKBFS:\n")
	dui.Printf("    status:    %s\n", c.boolString(status.KBFS.Running, "running", "not running"))
	dui.Printf("    version:   %s\n", status.KBFS.Version)
	dui.Printf("    log:       %s\n", status.KBFS.Log)
	dui.Printf("\nService:\n")
	dui.Printf("    status:    %s\n", c.boolString(status.Service.Running, "running", "not running"))
	dui.Printf("    version:   %s\n", status.Service.Version)
	dui.Printf("    log:       %s\n", status.Service.Log)
	dui.Printf("\nClient:\n")
	dui.Printf("    version:   %s\n", status.Client.Version)
	dui.Printf("\nDesktop App:\n")
	dui.Printf("    status:    %s\n\n", c.boolString(status.Desktop.Running, "running", "not running"))
	dui.Printf("Config path:   %s\n", status.ConfigPath)
	return nil
}

func (c *CmdNStatus) boolString(b bool, t, f string) string {
	if b {
		return t
	}
	return f
}

func (c *CmdNStatus) client() {
	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("Client:\n")
	dui.Printf("\tversion:\t%s\n", libkb.VersionString())
}

func (c *CmdNStatus) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
