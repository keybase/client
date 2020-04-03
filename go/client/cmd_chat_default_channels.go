package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	context "golang.org/x/net/context"
)

type CmdChatDefaultChannels struct {
	libkb.Contextified
	tlfName string
	convs   []string
}

func NewCmdChatDefaultChannelsRunner(g *libkb.GlobalContext) *CmdChatDefaultChannels {
	return &CmdChatDefaultChannels{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatDefaultChannels(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "default-channels",
		Usage:        "Set or get the default channels of a team",
		ArgumentHelp: "[team]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatDefaultChannelsRunner(g), "default-channels", c)
			cl.SetNoStandalone()
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags: []cli.Flag{
			cli.StringSliceFlag{
				Name: "channel",
				Usage: `Set the given channel name to be a default channels.
	New team members will automatically added to this channel.
	Can be specified multiple times.`,
			},
		},
	}
}

func (c *CmdChatDefaultChannels) Run() (err error) {
	chatClient, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}

	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}
	teamID, err := cli.GetTeamID(context.Background(), c.tlfName)
	if err != nil {
		return err
	}

	if len(c.convs) > 0 { // set channels first
		convIDs, err := lookupConvIDsByTopicName(c.G(), c.tlfName, chat1.ConversationMembersType_TEAM, c.convs)
		if err != nil {
			return err
		}
		_, err = chatClient.SetDefaultTeamChannelsLocal(context.TODO(), chat1.SetDefaultTeamChannelsLocalArg{
			TeamID: teamID,
			Convs:  convIDs,
		})
		if err != nil {
			return err
		}
	}

	resp, err := chatClient.GetDefaultTeamChannelsLocal(context.TODO(), teamID)
	if err != nil {
		return err
	}
	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("Default channels for %s are:\n", c.tlfName)
	dui.Printf("\t#general\n")
	for _, conv := range resp.Convs {
		dui.Printf("\t#%s\n", conv.Channel)
	}
	return nil
}

func (c *CmdChatDefaultChannels) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 1 {
		return BadArgsError{"Expected exactly one arg"}
	}
	c.tlfName = ctx.Args().Get(0)
	c.convs = ctx.StringSlice("channel")
	return nil
}

func (c *CmdChatDefaultChannels) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
