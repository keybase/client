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

type CmdChatArchive struct {
	libkb.Contextified
	resolvingRequest chatConversationResolvingRequest
	outputPath       string
}

func NewCmdChatArchiveRunner(g *libkb.GlobalContext) *CmdChatArchive {
	return &CmdChatArchive{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatArchive(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "archive",
		Usage:        "Archive all messages of chat conversation(s)",
		ArgumentHelp: "[<conversation>] [-o filename]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatArchiveRunner(g), "archive", c)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags: append(getConversationResolverFlags(), []cli.Flag{
			cli.StringFlag{
				Name:  "o, outfile",
				Usage: "Output directory name for the archive",
			}}...),
	}
}

func (c *CmdChatArchive) getQuery(req chatConversationResolvingRequest) chat1.GetInboxLocalQuery {
	var nameQuery *chat1.NameQuery
	if len(req.TlfName) > 0 {
		nameQuery = &chat1.NameQuery{
			Name:        req.TlfName,
			MembersType: req.MembersType,
		}
	}
	var topicName *string
	if len(req.TopicName) > 0 {
		topicName = &req.TopicName
	}
	return chat1.GetInboxLocalQuery{
		Name:          nameQuery,
		TopicName:     topicName,
		TopicType:     &req.TopicType,
		TlfVisibility: &req.Visibility,
	}
}

func (c *CmdChatArchive) Run() error {
	chatUI := NewChatCLIUI(c.G())
	notifyUI := NewChatCLINotifications(c.G())
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

	if c.resolvingRequest.TlfName != "" {
		// Unlike other resolution flows, we only want to specific a
		// topic name if it's explicitly passed in.
		err := annotateResolvingRequest2(c.G(), &c.resolvingRequest, false)
		if err != nil {
			return err
		}
	}
	query := c.getQuery(c.resolvingRequest)

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

	jobID, err := libkb.RandInt()
	if err != nil {
		return err
	}

	arg := chat1.ArchiveChatArg{
		JobID:            chat1.ArchiveJobID(fmt.Sprintf("chat-archive-%d", jobID)),
		OutputPath:       c.outputPath,
		Query:            &query,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	}

	// TODO plumb back output path if empty?
	_, err = client.ArchiveChat(context.TODO(), arg)
	if err != nil {
		return err
	}

	ui := c.G().UI.GetTerminalUI()
	ui.Printf("Archive completed to %s \n", c.outputPath)

	return nil
}

func (c *CmdChatArchive) ParseArgv(ctx *cli.Context) (err error) {
	var tlfName string
	if len(ctx.Args()) >= 1 {
		tlfName = ctx.Args().Get(0)
	}
	c.resolvingRequest, err = parseConversationResolvingRequest(ctx, tlfName)
	if err != nil {
		return err
	}
	c.outputPath = ctx.String("outfile")
	return nil
}

func (c *CmdChatArchive) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
