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

type CmdChatArchiveDelete struct {
	libkb.Contextified
	jobID chat1.ArchiveJobID
}

func NewCmdChatArchiveDeleteRunner(g *libkb.GlobalContext) *CmdChatArchiveDelete {
	return &CmdChatArchiveDelete{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatArchiveDelete(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "archive-delete",
		Usage:        "Clear the metadata of an archive job",
		ArgumentHelp: "job-id",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatArchiveDeleteRunner(g), "archive-delete", c)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
	}
}

func (c *CmdChatArchiveDelete) Run() error {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}

	arg := chat1.ArchiveChatDeleteArg{
		JobID:            c.jobID,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	}

	err = client.ArchiveChatDelete(context.TODO(), arg)
	if err != nil {
		return err
	}

	ui := c.G().UI.GetTerminalUI()
	ui.Printf("Job deleted\n")

	return nil
}

func (c *CmdChatArchiveDelete) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("job-id is required")
	}
	c.jobID = chat1.ArchiveJobID(ctx.Args().Get(0))
	return nil
}

func (c *CmdChatArchiveDelete) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
