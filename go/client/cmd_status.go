// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"reflect"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
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

func (c *CmdStatus) Run() error {
	status, err := c.load()
	if err != nil {
		return err
	}

	return c.output(status)
}

func (c *CmdStatus) load() (*keybase1.FullStatus, error) {
	cli, err := GetConfigClient(c.G())
	if err != nil {
		return nil, err
	}

	fstatus, err := cli.GetFullStatus(context.TODO(), 0)
	if err != nil {
		return nil, err
	}

<<<<<<< HEAD
	status.ConfigPath = config.ConfigPath
	status.Service.Version = config.Version

	status.Device = extStatus.Device

	if extStatus.Standalone {
		status.Service.Running = false
	} else {
		status.Service.Running = true
		if extStatus.ServiceLogPath != "" {
			status.Service.Log = extStatus.ServiceLogPath
		} else {
			status.Service.Log = filepath.Join(extStatus.LogDir, libkb.ServiceLogFileName)
		}
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
	status.LocalDbStats = extStatus.LocalDbStats
	status.LocalChatDbStats = extStatus.LocalChatDbStats
	status.CacheDirSizeInfo = extStatus.CacheDirSizeInfo
	status.UIRouterMapping = extStatus.UiRouterMapping

	// set anything os-specific:
	if err := c.osSpecific(&status); err != nil {
		return nil, err
=======
	if fstatus != nil {
		fstatus.Client.Version = libkb.VersionString()
>>>>>>> refactor to status pkg
	}
	return fstatus, nil
}

func (c *CmdStatus) output(status *keybase1.FullStatus) error {
	if c.json {
		return c.outputJSON(status)
	}

	return c.outputTerminal(status)
}

func (c *CmdStatus) outputJSON(status *keybase1.FullStatus) error {
	b, err := json.MarshalIndent(status, "", "    ")
	if err != nil {
		return err
	}
	dui := c.G().UI.GetDumbOutputUI()
	_, err = dui.Printf(string(b) + "\n")
	return err
}

func (c *CmdStatus) outputTerminal(status *keybase1.FullStatus) error {
	extStatus := status.ExtStatus
	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("Username:      %s\n", status.CurStatus.User.Username)
	dui.Printf("Logged in:     %s\n", BoolString(status.CurStatus.LoggedIn, "yes", "no"))
	if extStatus.Device != nil {
		dui.Printf("\nDevice:\n")
		dui.Printf("    name:      %s\n", extStatus.Device.Name)
		dui.Printf("    ID:        %s\n", extStatus.Device.DeviceID)
		dui.Printf("    status:    %s\n\n", libkb.DeviceStatusToString(&extStatus.Device.Status))
	}
	dui.Printf("Session:\n")
	dui.Printf("    is valid:  %s\n", BoolString(status.CurStatus.SessionIsValid, "yes", "no"))

	var deviceKeysLockStatus string
	switch {
	case extStatus.PassphraseStreamCached:
		deviceKeysLockStatus = "unlocked"
	case extStatus.DeviceSigKeyCached && extStatus.DeviceEncKeyCached:
		deviceKeysLockStatus = "unlocked"
	case extStatus.StoredSecret:
		deviceKeysLockStatus = "unlockable via stored secret"
	case extStatus.DeviceSigKeyCached:
		deviceKeysLockStatus = "signing only"
	case extStatus.DeviceEncKeyCached:
		deviceKeysLockStatus = "encryption only"
	default:
		deviceKeysLockStatus = "locked"
	}
	dui.Printf("    keys:      %s\n", deviceKeysLockStatus)

	dui.Printf("\nKey status:\n")
	dui.Printf("    stream:    %s\n", BoolString(extStatus.PassphraseStreamCached, "cached", "not cached"))
	dui.Printf("    secret:    %s\n", BoolString(extStatus.StoredSecret, "stored", "not stored"))
	dui.Printf("    dev sig:   %s\n", BoolString(extStatus.DeviceSigKeyCached, "cached", "not cached"))
	dui.Printf("    dev enc:   %s\n", BoolString(extStatus.DeviceEncKeyCached, "cached", "not cached"))
	dui.Printf("    paper sig: %s\n", BoolString(extStatus.PaperSigKeyCached, "cached", "not cached"))
	dui.Printf("    paper enc: %s\n", BoolString(extStatus.PaperEncKeyCached, "cached", "not cached"))
	dui.Printf("    prompt:    %s\n", BoolString(extStatus.SecretPromptSkip, "skip", "show"))
	dui.Printf("    tsec:      %s\n", BoolString(extStatus.TsecCached, "cached", "not cached"))

	dui.Printf("\nKBFS:\n")
	dui.Printf("    status:    %s\n", BoolString(status.Kbfs.Running, "running", "not running"))
	dui.Printf("    version:   %s\n", status.Kbfs.Version)
	dui.Printf("    installed: %s\n", status.Kbfs.InstalledVersion)
	dui.Printf("    log:       %s\n", status.Kbfs.Log)
	dui.Printf("    mount:     %s\n", status.Kbfs.Mount)
	dui.Printf("\nService:\n")
	dui.Printf("    status:    %s\n", BoolString(status.Service.Running, "running", "not running"))
	dui.Printf("    version:   %s\n", status.Service.Version)
	dui.Printf("    log:       %s\n", status.Service.Log)
	dui.Printf("    eklog:     %s\n", status.Service.EkLog)
	dui.Printf("\nUpdater:\n")
	dui.Printf("    log:       %s\n", status.Updater.Log)
	dui.Printf("\nPlatform Information:\n")
	dui.Printf("    OS:        %s\n", extStatus.PlatformInfo.Os)
	dui.Printf("    OS vers:   %s\n", extStatus.PlatformInfo.OsVersion)

	dui.Printf("    Runtime:   %s\n", extStatus.PlatformInfo.GoVersion)
	dui.Printf("    Arch:      %s\n", extStatus.PlatformInfo.Arch)
	dui.Printf("\nClient:\n")
	dui.Printf("    version:   %s\n", status.Client.Version)
	dui.Printf("\nDesktop app:\n")
	dui.Printf("    status:    %s\n", BoolString(status.Desktop.Running, "running", "not running"))
	dui.Printf("    version:   %s\n", status.Desktop.Version)
	dui.Printf("    log:       %s\n\n", status.Desktop.Log)
	dui.Printf("Config path:   %s\n", status.ConfigPath)
	dui.Printf("Default user:  %s\n", extStatus.DefaultUsername)
	dui.Printf("Other users:   %s\n", strings.Join(extStatus.ProvisionedUsernames, ", "))
	dui.Printf("Known DeviceEKs:\n")
	dui.Printf("    %s \n", strings.Join(extStatus.DeviceEkNames, "\n    "))
	dui.Printf("LocalDbStats:\n%s \n", strings.Join(extStatus.LocalDbStats, "\n"))
	dui.Printf("LocalChatDbStats:\n%s \n", strings.Join(extStatus.LocalChatDbStats, "\n"))
	dui.Printf("CacheDirSizeInfo:\n")
	for _, dirInfo := range extStatus.CacheDirSizeInfo {
		dui.Printf("%s: %s, (%d files)\n", dirInfo.Name, dirInfo.HumanSize, dirInfo.NumFiles)
	}

	c.outputClients(dui, extStatus.Clients, extStatus.UiRouterMapping)
	return nil
}

func (c *CmdStatus) outputClients(dui libkb.DumbOutputUI, clients []keybase1.ClientStatus, mappings map[string]int) {
	// Transform the mappings map from name -> connid to connid -> []name to make the data more compact
	mappedUIs := map[int][]string{}
	for key, value := range mappings {
		if _, ok := mappedUIs[value]; !ok {
			mappedUIs[value] = []string{}
		}
		mappedUIs[value] = append(mappedUIs[value], key)
	}

	var prev keybase1.ClientType
	for _, cli := range clients {
		if cli.Details.ClientType != prev {
			dui.Printf("\n%s:\n", cli.Details.ClientType)
			prev = cli.Details.ClientType
		}
		var vstr string
		if len(cli.Details.Version) > 0 {
			vstr = ", version: " + cli.Details.Version
		}
		var dstr string
		if len(cli.Details.Desc) > 0 {
			dstr = ", description: " + cli.Details.Desc
		}

		dui.Printf(
			"    %s [cid: %d, pid: %d%s%s]\n",
			strings.Join(cli.Details.Argv, " "),
			cli.ConnectionID,
			cli.Details.Pid,
			vstr,
			dstr,
		)
		if uis, ok := mappedUIs[cli.ConnectionID]; ok {
			dui.Printf("    Handled UIs: %s\n", strings.Join(uis, ", "))
		}
		if chans := formatNotificationChannels(cli.NotificationChannels); len(chans) != 0 {
			dui.Printf("    Notification subscriptions: %s\n", chans)
		}
	}
}

func formatNotificationChannels(channels keybase1.NotificationChannels) string {
	value := reflect.ValueOf(channels)
	typ := value.Type()

	items := []string{}
	for i := 0; i < value.NumField(); i++ {
		if casted, ok := value.Field(i).Interface().(bool); ok && casted {
			items = append(items, typ.Field(i).Name)
		}
	}

	return strings.Join(items, ", ")
}

func (c *CmdStatus) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
