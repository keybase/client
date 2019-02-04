// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
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
	PassphraseStreamCached bool
	TsecCached             bool
	DeviceSigKeyCached     bool
	DeviceEncKeyCached     bool
	PaperSigKeyCached      bool
	PaperEncKeyCached      bool
	StoredSecret           bool
	SecretPromptSkip       bool
	SessionIsValid         bool
	ConfigPath             string

	Client struct {
		Version string
	}
	Service struct {
		Version string
		Running bool
		Pid     string
		Log     string
		EKLog   string
	}
	KBFS struct {
		Version          string
		InstalledVersion string
		Running          bool
		Pid              string
		Log              string
		Mount            string
	}
	Desktop struct {
		Version string
		Running bool
		Log     string
	}
	Updater struct {
		Log string
	}
	Start struct {
		Log string
	}
	Git struct {
		Log string
	}

	DefaultUsername      string
	ProvisionedUsernames []string
	Clients              []keybase1.ClientDetails
	PlatformInfo         keybase1.PlatformInfo
	OSVersion            string
	DeviceEKNames        []string
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
		status.Service.EKLog = filepath.Join(extStatus.LogDir, libkb.EKLogFileName)
	}

	status.PassphraseStreamCached = extStatus.PassphraseStreamCached
	status.TsecCached = extStatus.TsecCached
	status.DeviceSigKeyCached = extStatus.DeviceSigKeyCached
	status.DeviceEncKeyCached = extStatus.DeviceEncKeyCached
	status.PaperSigKeyCached = extStatus.PaperSigKeyCached
	status.PaperEncKeyCached = extStatus.PaperEncKeyCached
	status.StoredSecret = extStatus.StoredSecret
	status.SecretPromptSkip = extStatus.SecretPromptSkip

	kbfsInstalledVersion, err := install.KBFSBundleVersion(c.G(), "")
	if err == nil {
		status.KBFS.InstalledVersion = kbfsInstalledVersion
	}
	if kbfs := getFirstClient(extStatus.Clients, keybase1.ClientType_KBFS); kbfs != nil {
		status.KBFS.Version = kbfs.Version
		status.KBFS.Running = true
		// This just gets the mountpoint from the environment; the
		// user could have technically passed a different mountpoint
		// to KBFS on macOS or Linux.  TODO(KBFS-2723): fetch the
		// actual mountpoint with a new RPC from KBFS.
		mountDir, err := c.G().Env.GetMountDir()
		if err != nil {
			return nil, err
		}
		status.KBFS.Mount = mountDir
	} else {
		status.KBFS.Version = kbfsInstalledVersion
	}

	if desktop := getFirstClient(extStatus.Clients, keybase1.ClientType_GUI_MAIN); desktop != nil {
		status.Desktop.Running = true
		status.Desktop.Version = desktop.Version
	}

	status.KBFS.Log = filepath.Join(extStatus.LogDir, libkb.KBFSLogFileName)
	status.Desktop.Log = filepath.Join(extStatus.LogDir, libkb.DesktopLogFileName)
	status.Updater.Log = filepath.Join(extStatus.LogDir, libkb.UpdaterLogFileName)

	status.Start.Log = filepath.Join(extStatus.LogDir, libkb.StartLogFileName)
	status.Git.Log = filepath.Join(extStatus.LogDir, libkb.GitLogFileName)

	status.DefaultUsername = extStatus.DefaultUsername
	status.ProvisionedUsernames = extStatus.ProvisionedUsernames
	status.Clients = extStatus.Clients
	status.PlatformInfo = extStatus.PlatformInfo
	status.DeviceEKNames = extStatus.DeviceEkNames

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
	dui.Printf("Session:\n")
	dui.Printf("    is valid:  %s\n", BoolString(status.SessionIsValid, "yes", "no"))

	var deviceKeysLockStatus string
	switch {
	case status.PassphraseStreamCached:
		deviceKeysLockStatus = "unlocked"
	case status.DeviceSigKeyCached && status.DeviceEncKeyCached:
		deviceKeysLockStatus = "unlocked"
	case status.StoredSecret:
		deviceKeysLockStatus = "unlockable via stored secret"
	case status.DeviceSigKeyCached:
		deviceKeysLockStatus = "signing only"
	case status.DeviceEncKeyCached:
		deviceKeysLockStatus = "encryption only"
	default:
		deviceKeysLockStatus = "locked"
	}
	dui.Printf("    keys:      %s\n", deviceKeysLockStatus)

	dui.Printf("\nKey status:\n")
	dui.Printf("    stream:    %s\n", BoolString(status.PassphraseStreamCached, "cached", "not cached"))
	dui.Printf("    secret:    %s\n", BoolString(status.StoredSecret, "stored", "not stored"))
	dui.Printf("    dev sig:   %s\n", BoolString(status.DeviceSigKeyCached, "cached", "not cached"))
	dui.Printf("    dev enc:   %s\n", BoolString(status.DeviceEncKeyCached, "cached", "not cached"))
	dui.Printf("    paper sig: %s\n", BoolString(status.PaperSigKeyCached, "cached", "not cached"))
	dui.Printf("    paper enc: %s\n", BoolString(status.PaperEncKeyCached, "cached", "not cached"))
	dui.Printf("    prompt:    %s\n", BoolString(status.SecretPromptSkip, "skip", "show"))
	dui.Printf("    tsec:      %s\n", BoolString(status.TsecCached, "cached", "not cached"))

	dui.Printf("\nKBFS:\n")
	dui.Printf("    status:    %s\n", BoolString(status.KBFS.Running, "running", "not running"))
	dui.Printf("    version:   %s\n", status.KBFS.Version)
	dui.Printf("    installed: %s\n", status.KBFS.InstalledVersion)
	dui.Printf("    log:       %s\n", status.KBFS.Log)
	dui.Printf("    mount:     %s\n", status.KBFS.Mount)
	dui.Printf("\nService:\n")
	dui.Printf("    status:    %s\n", BoolString(status.Service.Running, "running", "not running"))
	dui.Printf("    version:   %s\n", status.Service.Version)
	dui.Printf("    log:       %s\n", status.Service.Log)
	dui.Printf("    eklog:     %s\n", status.Service.EKLog)
	dui.Printf("\nUpdater:\n")
	dui.Printf("    log:       %s\n", status.Updater.Log)
	dui.Printf("\nPlatform Information:\n")
	dui.Printf("    OS:        %s\n", status.PlatformInfo.Os)
	dui.Printf("    OS vers:   %s\n", status.OSVersion)

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
	dui.Printf("Known DeviceEKs:\n")
	dui.Printf("    %s \n", strings.Join(status.DeviceEKNames, "\n    "))

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

// execToString returns the space-trimmed output of a command or an error.
func (c *CmdStatus) execToString(bin string, args []string) (string, error) {
	result, err := exec.Command(bin, args...).Output()
	if err != nil {
		return "", err
	}
	if result == nil {
		return "", fmt.Errorf("Nil result")
	}
	return strings.TrimSpace(string(result)), nil
}
