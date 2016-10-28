package client

import (
	"context"
	"fmt"
	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type CmdChatUpload struct {
	libkb.Contextified
	filename         string
	useStdin         bool
	size             int
	source           Source
	resolvingRequest chatConversationResolvingRequest
}

func newCmdChatUpload(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "upload",
		Usage:        "Upload an attachment to a conversation",
		ArgumentHelp: "[conversation [filename]]",
		Action: func(c *cli.Context) {
			cmd := &CmdChatUpload{Contextified: libkb.NewContextified(g)}
			cl.ChooseCommand(cmd, "upload", c)
		},
		Flags: append(getConversationResolverFlags(),
			mustGetChatFlags("stdin", "filename")...,
		),
	}
}

func (c *CmdChatUpload) useFileSource(filePath string) (err error) {
	c.source = NewFileSource(filePath)
	info, err := os.Stat(filePath)
	if err != nil {
		return err
	}
	if info.IsDir() {
		return fmt.Errorf("%s is a directory", filePath)
	}
	if len(c.filename) == 0 {
		c.filename = info.Name()
		c.size = int(info.Size())
	}
	return nil
}

func (c *CmdChatUpload) ParseArgv(ctx *cli.Context) (err error) {
	c.useStdin = ctx.Bool("stdin")
	c.filename = ctx.String("filename")

	var tlfName string
	// Get the TLF name from the first position arg
	if len(ctx.Args()) >= 1 {
		tlfName = ctx.Args().Get(0)
	}
	if c.resolvingRequest, err = parseConversationResolvingRequest(ctx, tlfName); err != nil {
		return err
	}

	if c.useStdin {
		if len(ctx.Args()) != 1 {
			return fmt.Errorf("need exactly 1 argument to upload from stdin")
		}
		if len(c.filename) == 0 {
			return fmt.Errorf("need --filename to upload from stdin")
		}
		c.source = &StdinSource{}
	} else {
		switch len(ctx.Args()) {
		case 0, 1:
			c.source = nil
		case 2:
			if err = c.useFileSource(ctx.Args().Get(1)); err != nil {
				return err
			}
		default:
			cli.ShowCommandHelp(ctx, "upload")
			return fmt.Errorf("chat upload takes 1 or 2 args")
		}
	}

	return nil
}

func (c *CmdChatUpload) Run() error {
	chatClient, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}
	resolver := &chatConversationResolver{G: c.G(), ChatClient: chatClient}
	resolver.TlfClient, err = GetTlfClient(c.G())
	if err != nil {
		return err
	}

	ctx := context.TODO()
	conversationInfo, userChosen, err := resolver.Resolve(ctx, c.resolvingRequest, chatConversationResolvingBehavior{
		CreateIfNotExists: true,
		Interactive:       !c.useStdin,
	})
	if err != nil {
		return err
	}

	arg := chat1.PostAttachmentLocalArg{
		ConversationID: conversationInfo.Id,
	}

	// arg.ClientHeader.{Sender,SenderDevice} are filled by service
	arg.ClientHeader.Conv = conversationInfo.Triple
	arg.ClientHeader.TlfName = conversationInfo.TlfName

	confirmed := !userChosen
	if c.source == nil {
		promptText := "Please enter the filepath to attachment: "
		if !confirmed {
			promptText = fmt.Sprintf("Upload attachment to [%s]? Hit Ctrl-C to cancel, or enter filepath to continue: ", conversationInfo.TlfName)
		}
		filePath, err := c.G().UI.GetTerminalUI().Prompt(PromptDescriptorEnterChatMessage, promptText)
		if err != nil {
			return err
		}
		if err = c.useFileSource(filePath); err != nil {
			return err
		}
		confirmed = true
	}

	if !confirmed {
		promptText := fmt.Sprintf("Upload to [%s]? Hit Ctrl-C to cancel, or enter to continue.", conversationInfo.TlfName)
		_, err = c.G().UI.GetTerminalUI().Prompt(PromptDescriptorEnterChatMessage, promptText)
		if err != nil {
			return err
		}
		confirmed = true
	}

	if err = c.source.Open(); err != nil {
		return err
	}
	defer c.source.Close()
	src := c.G().XStreams.ExportReader(c.source)

	if err = RegisterProtocolsWithContext([]rpc.Protocol{
		NewStreamUIProtocol(c.G()),
		chat1.ChatUiProtocol(&ChatUI{
			Contextified: libkb.NewContextified(c.G()),
			terminal:     c.G().UI.GetTerminalUI(),
		}),
	}, c.G()); err != nil {
		return err
	}

	arg.Attachment = chat1.LocalSource{
		Filename: c.filename,
		Size:     c.size,
		Source:   src,
	}

	if _, err = chatClient.PostAttachmentLocal(ctx, arg); err != nil {
		return err
	}
	return nil
}

func (c *CmdChatUpload) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}
