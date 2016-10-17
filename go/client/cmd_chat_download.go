package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdChatDownload struct {
	libkb.Contextified
	tlf        string
	messageID  string
	outputFile string
	preview    bool
}

func newCmdChatDownload(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "download",
		Usage:        "Download an attachment from a conversation",
		ArgumentHelp: "<conversation> <attachment id> [-o filename]",
		Action: func(c *cli.Context) {
			cmd := &CmdChatDownload{Contextified: libkb.NewContextified(g)}
			cl.ChooseCommand(cmd, "download", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "p, preview",
				Usage: "Download preview",
			},
			cli.StringFlag{
				Name:  "o, outfile",
				Usage: "Specify output file (stdout default)",
			},
		},
	}
}

func (c *CmdChatDownload) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 2 {
		return errors.New("usage: keybase chat download <conversation> <attachment id> [-o filename]")
	}
	c.tlf = ctx.Args()[0]
	c.messageID = ctx.Args()[1]
	c.outputFile = ctx.String("outfile")
	c.preview = ctx.Bool("preview")

	return nil
}

func (c *CmdChatDownload) Run() error {
	return nil
}

func (c *CmdChatDownload) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}
