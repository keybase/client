package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdChatArchiveList struct {
	libkb.Contextified
}

func NewCmdChatArchiveListListRunner(g *libkb.GlobalContext) *CmdChatArchiveList {
	return &CmdChatArchiveList{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatArchiveList(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "archive-list",
		Usage: "List metadata about chat archive jobs",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatArchiveListListRunner(g), "archive-list", c)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
	}
}

func (c *CmdChatArchiveList) Run() error {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}

	res, err := client.ArchiveChatList(context.TODO(), keybase1.TLFIdentifyBehavior_CHAT_CLI)
	if err != nil {
		return err
	}
	ui := c.G().UI.GetTerminalUI()
	ui.Printf("Found %d job(s)\n", len(res.Jobs))
	for _, job := range res.Jobs {
		ui.Printf(`Job ID: %s
Output Path: %s
Started At: %s
Status: %s
`, job.Request.JobID, job.Request.OutputPath, gregor1.FromTime(job.StartedAt).Format("2006-01-02 15:04:05"), job.Status.String())
		if job.Err != "" {
			ui.Printf("Err: %s\n", job.Err)
		}
	}
	return nil
}

func (c *CmdChatArchiveList) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) > 0 {
		return fmt.Errorf("no arguments required")
	}
	return nil
}

func (c *CmdChatArchiveList) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
