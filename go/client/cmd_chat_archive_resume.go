package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type CmdChatArchiveResume struct {
	libkb.Contextified
	jobID chat1.ArchiveJobID
}

func NewCmdChatArchiveResumeRunner(g *libkb.GlobalContext) *CmdChatArchiveResume {
	return &CmdChatArchiveResume{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatArchiveResume(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "archive-resume",
		Usage:        "Continue a paused archive job",
		ArgumentHelp: "job-id",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatArchiveResumeRunner(g), "archive-resume", c)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
	}
}

type ArchiveCompleteWaiter struct {
	chat1.NotifyChatInterface
	cli *ChatCLINotifications
	ch  chan struct{}
}

var _ chat1.NotifyChatInterface = (*ArchiveCompleteWaiter)(nil)

func NewArchiveCompleteWaiter(g *libkb.GlobalContext) *ArchiveCompleteWaiter {
	return &ArchiveCompleteWaiter{
		cli: NewChatCLINotifications(g),
		ch:  make(chan struct{}),
	}
}

func (n *ArchiveCompleteWaiter) Done() chan struct{} {
	return n.ch
}

func (n *ArchiveCompleteWaiter) ChatArchiveComplete(ctx context.Context,
	arg chat1.ArchiveJobID) error {
	err := n.cli.ChatArchiveComplete(ctx, arg)
	close(n.ch)
	return err
}

func (n *ArchiveCompleteWaiter) ChatArchiveProgress(ctx context.Context,
	arg chat1.ChatArchiveProgressArg) error {
	return n.cli.ChatArchiveProgress(ctx, arg)
}

func (c *CmdChatArchiveResume) Run() error {
	chatUI := NewChatCLIUI(c.G())
	notifyUI := NewArchiveCompleteWaiter(c.G())
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}

	protocols := []rpc.Protocol{
		NewStreamUIProtocol(c.G()),
		chat1.ChatUiProtocol(chatUI),
		chat1.NotifyChatProtocol(notifyUI),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	cli, err := GetNotifyCtlClient(c.G())
	if err != nil {
		return err
	}
	channels := keybase1.NotificationChannels{
		Chatarchive: true,
	}
	if err := cli.SetNotifications(context.TODO(), channels); err != nil {
		return err
	}

	arg := chat1.ArchiveChatResumeArg{
		JobID:            c.jobID,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	}

	ctx := context.TODO()
	err = client.ArchiveChatResume(ctx, arg)
	if err != nil {
		return err
	}

	ui := c.G().UI.GetTerminalUI()
	ui.Printf("Job resumed\n")

	select {
	case <-notifyUI.Done():
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (c *CmdChatArchiveResume) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("job-id is required")
	}
	c.jobID = chat1.ArchiveJobID(ctx.Args().Get(0))
	return nil
}

func (c *CmdChatArchiveResume) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
