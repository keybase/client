// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

func NewCmdStatus(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "status",
		Usage: "Show information about current user",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdStatus{Contextified: libkb.NewContextified(g)}, "status", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "j, json",
				Usage: "Output status as JSON",
			},
		},
	}
}

type CmdStatus struct {
	libkb.Contextified
	json bool
}

func (c *CmdStatus) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 0 {
		return UnexpectedArgsError("status")
	}
	c.json = ctx.Bool("json")
	return nil
}

type fstatus struct {
	Username               string
	UserID                 string
	Device                 *keybase1.Device
	LoggedInProvisioned    bool `json:"LoggedIn"`
	PassphraseStreamCached bool `json:"KeychainUnlocked"`
	LKSecLoaded            bool `json:"LocalKeySecurityLoaded"`
	SessionIsValid         bool `json:"SessionIsValid"`
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
		Version string
		Running bool
		Log     string
	}

	DefaultUsername      string
	ProvisionedUsernames []string
	Clients              []keybase1.ClientDetails
	PlatformInfo         keybase1.PlatformInfo
}

func (c *CmdStatus) Run() error {
	status, err := c.load()
	if err != nil {
		return err
	}

	return c.output(status)
}

func getFirstClient(v []keybase1.ClientDetails, typ keybase1.ClientType) *keybase1.ClientDetails {
	for _, cli := range v {
		if cli.ClientType == typ {
			return &cli
		}
	}
	return nil
}

func (c *CmdStatus) load() (*fstatus, error) {
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
	status.SessionIsValid = curStatus.SessionIsValid
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

	status.Device = extStatus.Device

	if extStatus.Standalone {
		status.Service.Running = false
	} else {
		status.Service.Running = true
		status.Service.Log = filepath.Join(extStatus.LogDir, libkb.ServiceLogFileName)
	}

	status.SessionStatus = c.sessionStatus(extStatus.Session)
	status.PassphraseStreamCached = extStatus.PassphraseStreamCached
	status.LKSecLoaded = extStatus.LksecLoaded

	if kbfs := getFirstClient(extStatus.Clients, keybase1.ClientType_KBFS); kbfs != nil {
		status.KBFS.Version = kbfs.Version
		status.KBFS.Running = true
	} else {
		kbfsVersion, err := install.KBFSBundleVersion(c.G(), "")
		if err == nil {
			status.KBFS.Version = kbfsVersion
		}
	}

	if desktop := getFirstClient(extStatus.Clients, keybase1.ClientType_GUI); desktop != nil {
		status.Desktop.Running = true
		status.Desktop.Version = desktop.Version
	}

	status.KBFS.Log = filepath.Join(extStatus.LogDir, libkb.KBFSLogFileName)
	status.Desktop.Log = filepath.Join(extStatus.LogDir, libkb.DesktopLogFileName)

	status.DefaultUsername = extStatus.DefaultUsername
	status.ProvisionedUsernames = extStatus.ProvisionedUsernames
	status.Clients = extStatus.Clients
	status.PlatformInfo = extStatus.PlatformInfo

	// set anything os-specific:
	if err := c.osSpecific(&status); err != nil {
		return nil, err
	}

	return &status, nil
}

func (c *CmdStatus) output(status *fstatus) error {
	if c.json {
		return c.outputJSON(status)
	}

	return c.outputTerminal(status)
}

func (c *CmdStatus) outputJSON(status *fstatus) error {
	b, err := json.MarshalIndent(status, "", "    ")
	if err != nil {
		return err
	}
	dui := c.G().UI.GetDumbOutputUI()
	_, err = dui.Printf(string(b) + "\n")
	return err
}

func (c *CmdStatus) outputTerminal(status *fstatus) error {
	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("Username:      %s\n", status.Username)
	dui.Printf("Logged in:     %s\n", BoolString(status.LoggedInProvisioned, "yes", "no"))
	if status.Device != nil {
		dui.Printf("\nDevice:\n")
		dui.Printf("    name:      %s\n", status.Device.Name)
		dui.Printf("    ID:        %s\n", status.Device.DeviceID)
		dui.Printf("    status:    %s\n\n", libkb.DeviceStatusToString(&status.Device.Status))
	}
	dui.Printf("Session:       %s\n", status.SessionStatus)
	dui.Printf("    is valid:  %s\n", BoolString(status.SessionIsValid, "yes", "no"))
	dui.Printf("    keys:      %s\n", BoolString(status.PassphraseStreamCached, "unlocked", "locked"))
	dui.Printf("    lksec:     %s\n", BoolString(status.LKSecLoaded, "loaded", "not loaded"))
	dui.Printf("\nKBFS:\n")
	dui.Printf("    status:    %s\n", BoolString(status.KBFS.Running, "running", "not running"))
	dui.Printf("    version:   %s\n", status.KBFS.Version)
	dui.Printf("    log:       %s\n", status.KBFS.Log)
	dui.Printf("\nService:\n")
	dui.Printf("    status:    %s\n", BoolString(status.Service.Running, "running", "not running"))
	dui.Printf("    version:   %s\n", status.Service.Version)
	dui.Printf("    log:       %s\n", status.Service.Log)
	dui.Printf("\nPlatform Information:\n")
	dui.Printf("    OS:        %s\n", status.PlatformInfo.Os)
	dui.Printf("    Runtime:   %s\n", status.PlatformInfo.GoVersion)
	dui.Printf("    Arch:      %s\n", status.PlatformInfo.Arch)
	dui.Printf("\nClient:\n")
	dui.Printf("    version:   %s\n", status.Client.Version)
	dui.Printf("\nDesktop app:\n")
	dui.Printf("    status:    %s\n", BoolString(status.Desktop.Running, "running", "not running"))
	dui.Printf("    version:   %s\n", status.Desktop.Version)
	dui.Printf("    log:       %s\n\n", status.Desktop.Log)
	dui.Printf("Config path:   %s\n", status.ConfigPath)
	dui.Printf("Default user:  %s\n", status.DefaultUsername)
	dui.Printf("Other users:   %s\n", strings.Join(status.ProvisionedUsernames, ", "))

	c.outputClients(dui, status.Clients)
	return nil
}

func (c *CmdStatus) outputClients(dui libkb.DumbOutputUI, clients []keybase1.ClientDetails) {
	var prev keybase1.ClientType
	for _, cli := range clients {
		if cli.ClientType != prev {
			dui.Printf("\n%s:\n", cli.ClientType)
			prev = cli.ClientType
		}
		var vstr string
		if len(cli.Version) > 0 {
			vstr = ", version: " + cli.Version
		}
		var dstr string
		if len(cli.Desc) > 0 {
			dstr = ", description: " + cli.Desc
		}
		dui.Printf("    %s [pid: %d%s%s]\n", strings.Join(cli.Argv, " "), cli.Pid, vstr, dstr)
	}
}

func (c *CmdStatus) client() {
	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("Client:\n")
	dui.Printf("\tversion:\t%s\n", libkb.VersionString())
}

func (c *CmdStatus) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

func (c *CmdStatus) sessionStatus(s *keybase1.SessionStatus) string {
	if s == nil {
		return "no session"
	}
	if s.SaltOnly {
		return fmt.Sprintf("%s [salt only]", s.SessionFor)
	}

	return fmt.Sprintf("%s [loaded: %s, cleared: %s, expired: %s]", s.SessionFor, BoolString(s.Loaded, "yes", "no"), BoolString(s.Cleared, "yes", "no"), BoolString(s.Expired, "yes", "no"))
}
