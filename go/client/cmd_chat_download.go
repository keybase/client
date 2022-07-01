package client

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strconv"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	isatty "github.com/mattn/go-isatty"
)

type CmdChatDownload struct {
	libkb.Contextified
	hasTTY           bool
	resolvingRequest chatConversationResolvingRequest
	messageID        uint64
	outputFile       string
	preview          bool
}

func newCmdChatDownload(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "download",
		Usage:        "Download an attachment from a conversation",
		ArgumentHelp: "<conversation> <attachment id> [-o filename]",
		Action: func(c *cli.Context) {
			cmd := &CmdChatDownload{Contextified: libkb.NewContextified(g)}
			cl.ChooseCommand(cmd, "download", c)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags: append([]cli.Flag{
			cli.BoolFlag{
				Name:  "p, preview",
				Usage: "Download preview",
			},
			cli.StringFlag{
				Name:  "o, outfile",
				Usage: "Specify output file (stdout default)",
			},
		}, getConversationResolverFlags()...),
	}
}

func (c *CmdChatDownload) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 2 {
		return errors.New("usage: keybase chat download <conversation> <attachment id> [-o filename]")
	}
	tlfName := ctx.Args()[0]
	if c.resolvingRequest, err = parseConversationResolvingRequest(ctx, tlfName); err != nil {
		return err
	}
	id, err := strconv.ParseUint(ctx.Args()[1], 10, 64)
	if err != nil {
		return err
	}
	c.messageID = id
	c.outputFile = ctx.String("outfile")
	if len(c.outputFile) == 0 {
		c.outputFile = "-" // stdout
	} else {
		c.outputFile = libkb.GetSafePath(c.outputFile)
	}
	c.preview = ctx.Bool("preview")
	c.hasTTY = isatty.IsTerminal(os.Stdin.Fd())

	return nil
}

func (c *CmdChatDownload) Run() (err error) {
	ui := NewChatCLIUI(c.G())
	protocols := []rpc.Protocol{
		chat1.ChatUiProtocol(ui),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	if err = annotateResolvingRequest(c.G(), &c.resolvingRequest); err != nil {
		return err
	}

	if err := CheckAndStartStandaloneChat(c.G(), c.resolvingRequest.MembersType); err != nil {
		return err
	}

	resolver, err := newChatConversationResolver(c.G())
	if err != nil {
		return err
	}

	conversation, _, err := resolver.Resolve(context.TODO(), c.resolvingRequest, chatConversationResolvingBehavior{
		CreateIfNotExists: false,
		MustNotExist:      false,
		Interactive:       c.hasTTY,
		IdentifyBehavior:  keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	switch err.(type) {
	case nil:
	case libkb.ResolutionError:
		return fmt.Errorf("could not resolve `%s` into Keybase user(s) or a team", c.resolvingRequest.TlfName)
	default:
		return err
	}
	opts := downloadOptionsV1{
		ConversationID: conversation.Info.Id.ConvIDStr(),
		MessageID:      chat1.MessageID(c.messageID),
		Output:         c.outputFile,
		Preview:        c.preview,
	}
	h := newChatServiceHandler(c.G())
	reply := h.DownloadV1(context.Background(), opts, NewChatCLIUI(c.G()), NewChatCLINotifications(c.G()))
	if reply.Error != nil {
		return errors.New(reply.Error.Message)
	}
	return nil
}

func (c *CmdChatDownload) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}
