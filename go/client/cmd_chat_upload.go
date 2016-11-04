package client

import (
	"context"
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdChatUpload struct {
	libkb.Contextified
	tlf      string
	filename string
	public   bool
	title    string
}

func newCmdChatUpload(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "upload",
		Usage:        "Upload an attachment to a conversation",
		ArgumentHelp: "<conversation> <filename>",
		Action: func(c *cli.Context) {
			cmd := &CmdChatUpload{Contextified: libkb.NewContextified(g)}
			cl.ChooseCommand(cmd, "upload", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "public",
				Usage: "Send to public conversation (default private)",
			},
			cli.StringFlag{
				Name:  "title",
				Usage: "Title of attachment (defaults to filename)",
			},
		},
	}
}

func (c *CmdChatUpload) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 2 {
		return errors.New("usage: keybase chat upload <conversation> <filename>")
	}
	c.tlf = ctx.Args()[0]
	c.filename = ctx.Args()[1]
	c.public = ctx.Bool("public")
	c.title = ctx.String("title")

	return nil
}

func (c *CmdChatUpload) Run() error {
	opts := attachOptionsV1{
		Channel: ChatChannel{
			Name:   c.tlf,
			Public: c.public,
		},
		Filename: c.filename,
		Title:    c.title,
	}
	h := newChatServiceHandler(c.G())
	reply := h.AttachV1(context.Background(), opts)
	if reply.Error != nil {
		return errors.New(reply.Error.Message)
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
