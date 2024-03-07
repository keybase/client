package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdChatArchivePause struct {
	libkb.Contextified
	jobID chat1.ArchiveJobID
}

func NewCmdChatArchivePauseRunner(g *libkb.GlobalContext) *CmdChatArchivePause {
	return &CmdChatArchivePause{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatArchivePause(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "archive-pause",
		Usage:        "Pause a running archive job",
		ArgumentHelp: "job-id",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatArchivePauseRunner(g), "archive-pause", c)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
	}
}

func (c *CmdChatArchivePause) Run() error {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}

	arg := chat1.ArchiveChatPauseArg{
		JobID:            c.jobID,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	}

	err = client.ArchiveChatPause(context.TODO(), arg)
	if err != nil {
		return err
	}

	ui := c.G().UI.GetTerminalUI()
	ui.Printf("Job paused\n")

	return nil
}

func (c *CmdChatArchivePause) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("job-id is required")
	}
	c.jobID = chat1.ArchiveJobID(ctx.Args().Get(0))
	return nil
}

func (c *CmdChatArchivePause) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
