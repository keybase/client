package client

import (
	"strconv"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context"
)

type CmdChatSetNotificationSettings struct {
	libkb.Contextified
	settings chat1.GlobalAppNotificationSettings
}

func NewCmdChatSetNotificationSettingsRunner(g *libkb.GlobalContext) *CmdChatSetNotificationSettings {
	return &CmdChatSetNotificationSettings{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatSetNotificationSettings(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := []cli.Flag{}
	for _, setting := range chat1.GlobalAppNotificationSettingsSorted() {
		flags = append(flags, cli.BoolFlag{
			Name:  setting.FlagName(),
			Usage: setting.Usage(),
		})
	}
	return cli.Command{
		Name:  "notification-settings",
		Usage: "Manage personal notification settings",
		Examples: `
View the current settings:
    keybase chat notification-settings

Enable plaintext notifications:
    keybase chat notification-settings --plaintext-mobile

Disable plaintext notifications:
    keybase chat notification-settings --plaintext-mobile=0
`,
		ArgumentHelp: "[options]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatSetNotificationSettingsRunner(g), "notification-settings", c)
		},
		Flags: flags,
	}
}

func (c *CmdChatSetNotificationSettings) Run() error {
	if len(c.settings.Settings) > 0 {
		if err := c.setGlobalAppNotificationSettings(context.TODO()); err != nil {
			return err
		}
	}
	return c.getGlobalAppNotificationSettings(context.TODO())
}

func (c *CmdChatSetNotificationSettings) ParseArgv(ctx *cli.Context) (err error) {
	c.settings.Settings = make(map[chat1.GlobalAppNotificationSetting]bool)
	for _, setting := range chat1.GlobalAppNotificationSettingsSorted() {
		flagName := setting.FlagName()
		if ctx.IsSet(flagName) {
			c.settings.Settings[setting] = ctx.Bool(flagName)
		}
	}
	return nil
}

func (c *CmdChatSetNotificationSettings) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

func (c *CmdChatSetNotificationSettings) setGlobalAppNotificationSettings(ctx context.Context) error {
	lcli, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}

	strSettings := map[string]bool{}
	for setting, enabled := range c.settings.Settings {
		strSettings[strconv.FormatInt(int64(setting), 10)] = enabled
	}
	return lcli.SetGlobalAppNotificationSettingsLocal(ctx, strSettings)
}

func (c *CmdChatSetNotificationSettings) getGlobalAppNotificationSettings(ctx context.Context) error {
	lcli, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}
	settings, err := lcli.GetGlobalAppNotificationSettingsLocal(ctx)
	if err != nil {
		return err
	}
	dui := c.G().UI.GetDumbOutputUI()
	for _, setting := range chat1.GlobalAppNotificationSettingsSorted() {
		enabledStr := "disabled"
		if settings.Settings[setting] {
			enabledStr = "enabled"
		}
		dui.Printf("%v (%v)\n\t%v\n", setting.FlagName(), enabledStr, setting.Usage())
	}
	return nil
}
