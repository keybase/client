package client

import (
	"fmt"
	"slices"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/chatrender"
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
	ui.Printf("Found %d job(s)\n\n", len(res.Jobs))
	for _, job := range res.Jobs {
		percent := 100
		if job.MessagesTotal > 0 {
			percent = int((100 * job.MessagesComplete) / job.MessagesTotal)
		}
		matchingConvs := ""
		if job.Request.Query == nil || (job.Request.Query.Name == nil && job.Request.Query.TopicName == nil && len(job.Request.Query.ConvIDs) == 0) {
			matchingConvs = "<all chat>"
		} else {
			names := make([]string, 0, len(job.MatchingConvs))
			for _, conv := range job.MatchingConvs {
				name := conv.Name
				if len(name) == 0 {
					continue
				}
				if conv.Channel != "" {
					name += fmt.Sprintf("#%s", conv.Channel)
				}
				names = append(names, name)
			}
			slices.Sort(names)
			matchingConvs += strings.Join(names, "\n")
		}
		ui.Printf(`Job ID: %s
Matching Conversations:
%s
Output Path: %s
Started At: %s (%s)
Status: %s
Progress: %d%% (%d of %d messages archived)
`, job.Request.JobID, matchingConvs, job.Request.OutputPath,
			chatrender.FmtTime(gregor1.FromTime(job.StartedAt), chatrender.RenderOptions{UseDateTime: true}),
			chatrender.FmtTime(gregor1.FromTime(job.StartedAt), chatrender.RenderOptions{}),
			job.Status.String(), percent, job.MessagesComplete, job.MessagesTotal)
		if job.Err != "" {
			ui.Printf("Err: %s\n", job.Err)
		}
		ui.Printf("\n")
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
