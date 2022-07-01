package client

import (
	"fmt"
	"time"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context"
)

type CmdChatListEmoji struct {
	libkb.Contextified
}

func newCmdChatListEmoji(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "emoji-list",
		Usage:        "List all sendable emojis",
		ArgumentHelp: "",
		Action: func(c *cli.Context) {
			cmd := &CmdChatListEmoji{Contextified: libkb.NewContextified(g)}
			cl.ChooseCommand(cmd, "emoji-list", c)
		},
	}
}

func (c *CmdChatListEmoji) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdChatListEmoji) Run() error {
	ctx := context.Background()
	cli, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}
	res, err := cli.UserEmojis(ctx, chat1.UserEmojisArg{
		Opts: chat1.EmojiFetchOpts{
			GetCreationInfo: true,
			GetAliases:      true,
		},
		ConvID: nil,
	})
	if err != nil {
		return err
	}
	dui := c.G().UI.GetDumbOutputUI()
	for _, group := range res.Emojis.Emojis {
		dui.Printf("Name: %s\n", group.Name)
		for _, emoji := range group.Emojis {
			var source string
			typ, _ := emoji.RemoteSource.Typ()
			switch typ {
			case chat1.EmojiRemoteSourceTyp_MESSAGE:
				source = fmt.Sprintf("convID: %s msgID: %d", emoji.RemoteSource.Message().ConvID,
					emoji.RemoteSource.Message().MsgID)
			case chat1.EmojiRemoteSourceTyp_STOCKALIAS:
				source = emoji.RemoteSource.Stockalias().Text
			default:
				source = "???"
			}
			var creator string
			var timeStr string
			if emoji.CreationInfo != nil {
				creator = emoji.CreationInfo.Username
				timeStr = emoji.CreationInfo.Time.Time().Format(time.UnixDate)
			}
			dui.Printf("%s creator: %s time: %s src: %s\n", emoji.Alias, creator, timeStr, source)
		}
	}
	return nil
}

func (c *CmdChatListEmoji) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}
