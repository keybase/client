// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"fmt"
	"path"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
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
	SessionStatus          string
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

	DefaultUsername      string
	ProvisionedUsernames []string
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

	status.SessionStatus = c.sessionStatus(extStatus.Session)
	status.PassphraseStreamCached = extStatus.PassphraseStreamCached

	kbfsVersion, err := install.KBFSBundleVersion(c.G(), "")
	if err == nil {
		status.KBFS.Version = kbfsVersion
	}
	status.KBFS.Log = path.Join(extStatus.LogDir, c.kbfsLogFilename())

	status.Desktop.Running = extStatus.DesktopUIConnected

	status.DefaultUsername = extStatus.DefaultUsername
	status.ProvisionedUsernames = extStatus.ProvisionedUsernames

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

func (c *CmdNStatus) outputTerminal(status *fstatus) error {
	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("Username:      %s\n", status.Username)
	dui.Printf("Logged in:     %s\n\n", BoolString(status.LoggedInProvisioned, "yes", "no"))
	dui.Printf("Device name:   %s\n", status.DeviceName)
	dui.Printf("Device ID:     %s\n", status.DeviceID)
	dui.Printf("Device status: %s\n\n", status.DeviceStatus)
	dui.Printf("Local keybase keychain: %s\n", BoolString(status.PassphraseStreamCached, "unlocked", "locked"))
	dui.Printf("Session status:         %s\n", status.SessionStatus)
	dui.Printf("\nKBFS:\n")
	dui.Printf("    status:    %s\n", BoolString(status.KBFS.Running, "running", "not running"))
	dui.Printf("    version:   %s\n", status.KBFS.Version)
	dui.Printf("    log:       %s\n", status.KBFS.Log)
	dui.Printf("\nService:\n")
	dui.Printf("    status:    %s\n", BoolString(status.Service.Running, "running", "not running"))
	dui.Printf("    version:   %s\n", status.Service.Version)
	dui.Printf("    log:       %s\n", status.Service.Log)
	dui.Printf("\nClient:\n")
	dui.Printf("    version:   %s\n", status.Client.Version)
	dui.Printf("\nDesktop app:\n")
	dui.Printf("    status:    %s\n\n", BoolString(status.Desktop.Running, "running", "not running"))
	dui.Printf("Config path:        %s\n", status.ConfigPath)
	dui.Printf("Default user:       %s\n", status.DefaultUsername)
	dui.Printf("Provisioned users:  %s\n", strings.Join(status.ProvisionedUsernames, ", "))
	return nil
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

func (c *CmdNStatus) sessionStatus(s *keybase1.SessionStatus) string {
	if s == nil {
		return "no session"
	}
	if s.SaltOnly {
		return fmt.Sprintf("%s [salt only]", s.SessionFor)
	}

	return fmt.Sprintf("%s [loaded: %s, cleared: %s, expired: %s]", s.SessionFor, BoolString(s.Loaded, "yes", "no"), BoolString(s.Cleared, "yes", "no"), BoolString(s.Expired, "yes", "no"))
}
