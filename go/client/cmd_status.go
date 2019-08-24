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

	if fstatus != nil {
		fstatus.Client.Version = libkb.VersionString()
	}
	return fstatus, nil
}

func (c *CmdStatus) output(status *keybase1.FullStatus) error {
	if c.json {
		return c.outputJSON(status)
	}

	return c.outputTerminal(status)
}

// Used when outputting the status as json. Human-readable/legacy format
// preceding keybase1.FullStatus
type jsonStatus struct {
	Username               string
	UserID                 string
	Device                 *keybase1.Device
	LoggedIn               bool
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

	DefaultUsername        string
	ProvisionedUsernames   []string
	ConfiguredAccounts     []keybase1.ConfiguredAccount
	Clients                []keybase1.ClientStatus
	PlatformInfo           keybase1.PlatformInfo
	OSVersion              string
	DeviceEKNames          []string
	LocalDbStats           []string
	LocalChatDbStats       []string
	LocalBlockCacheDbStats []string `json:",omitempty"`
	LocalSyncCacheDbStats  []string `json:",omitempty"`
	CacheDirSizeInfo       []keybase1.DirSizeInfo
	UIRouterMapping        map[string]int
}

func (c *CmdStatus) outputJSON(fstatus *keybase1.FullStatus) error {
	status := jsonStatus{}
	status.Username = fstatus.Username
	status.ConfigPath = fstatus.ConfigPath

	var uid keybase1.UID
	if fstatus.CurStatus.User != nil {
		uid = fstatus.CurStatus.User.Uid
	}
	status.UserID = uid.String()
	status.SessionIsValid = fstatus.CurStatus.SessionIsValid
	status.LoggedIn = fstatus.CurStatus.LoggedIn

	status.Device = fstatus.ExtStatus.Device
	status.DeviceSigKeyCached = fstatus.ExtStatus.DeviceSigKeyCached
	status.DeviceEncKeyCached = fstatus.ExtStatus.DeviceEncKeyCached
	status.PaperSigKeyCached = fstatus.ExtStatus.PaperSigKeyCached
	status.PaperEncKeyCached = fstatus.ExtStatus.PaperEncKeyCached
	status.StoredSecret = fstatus.ExtStatus.StoredSecret
	status.SecretPromptSkip = fstatus.ExtStatus.SecretPromptSkip
	status.DefaultUsername = fstatus.ExtStatus.DefaultUsername
	status.ProvisionedUsernames = fstatus.ExtStatus.ProvisionedUsernames
	status.ConfiguredAccounts = fstatus.ExtStatus.ConfiguredAccounts
	status.Clients = fstatus.ExtStatus.Clients
	status.PlatformInfo = fstatus.ExtStatus.PlatformInfo
	status.OSVersion = fstatus.ExtStatus.PlatformInfo.OsVersion
	status.DeviceEKNames = fstatus.ExtStatus.DeviceEkNames
	status.LocalDbStats = fstatus.ExtStatus.LocalDbStats
	status.LocalChatDbStats = fstatus.ExtStatus.LocalChatDbStats
	status.LocalBlockCacheDbStats = fstatus.ExtStatus.LocalBlockCacheDbStats
	status.LocalSyncCacheDbStats = fstatus.ExtStatus.LocalSyncCacheDbStats
	status.CacheDirSizeInfo = fstatus.ExtStatus.CacheDirSizeInfo
	status.UIRouterMapping = fstatus.ExtStatus.UiRouterMapping

	status.Client.Version = fstatus.Client.Version

	status.Service.Version = fstatus.Service.Version
	status.Service.Running = fstatus.Service.Running
	status.Service.Pid = fstatus.Service.Pid
	status.Service.Log = fstatus.Service.Log
	status.Service.EKLog = fstatus.Service.EkLog

	status.KBFS.Version = fstatus.Kbfs.Version
	status.KBFS.InstalledVersion = fstatus.Kbfs.InstalledVersion
	status.KBFS.Running = fstatus.Kbfs.Running
	status.KBFS.Pid = fstatus.Kbfs.Pid
	status.KBFS.Log = fstatus.Kbfs.Log
	status.KBFS.Mount = fstatus.Kbfs.Mount

	status.Desktop.Version = fstatus.Desktop.Version
	status.Desktop.Running = fstatus.Desktop.Running
	status.Desktop.Log = fstatus.Desktop.Log

	status.Updater.Log = fstatus.Updater.Log
	status.Start.Log = fstatus.Start.Log
	status.Git.Log = fstatus.Git.Log

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
	dui.Printf("Username:      %s\n", status.Username)
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
	dui.Printf("Configured accounts:\n")
	for _, account := range extStatus.ConfiguredAccounts {
		var details []string
		if account.IsCurrent {
			details = append(details, "current")
		}
		if account.HasStoredSecret {
			details = append(details, "logged in")
		}
		var detailsStr string
		if len(details) > 0 {
			detailsStr = " (" + strings.Join(details, ", ") + ")"
		}
		dui.Printf("    %s%s\n", account.Username, detailsStr)
	}
	dui.Printf("Known DeviceEKs:\n")
	dui.Printf("    %s \n", strings.Join(extStatus.DeviceEkNames, "\n    "))
	dui.Printf("LocalDbStats:\n%s \n", strings.Join(extStatus.LocalDbStats, "\n"))
	dui.Printf("LocalChatDbStats:\n%s \n", strings.Join(extStatus.LocalChatDbStats, "\n"))
	dui.Printf("LocalBlockCacheDbStats:\n%s \n", strings.Join(extStatus.LocalBlockCacheDbStats, "\n"))
	dui.Printf("LocalSyncCacheDbStats:\n%s \n", strings.Join(extStatus.LocalSyncCacheDbStats, "\n"))
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
