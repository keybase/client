package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type cmdWotVouch struct {
	attestation string
	confidence  keybase1.Confidence
	libkb.Contextified
}

func newCmdWotVouch(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := []cli.Flag{
		cli.StringFlag{
			Name:  "m, message",
			Usage: "A message about this user",
		},
		cli.StringFlag{
			Name:  "vouched-by",
			Usage: "Comma-separated list of keybase users who vouched for this user",
		},
		cli.StringFlag{
			Name:  "verified-via",
			Usage: "How you verified their identity: audio, video, email, other_chat, in_person",
		},
		cli.IntFlag{
			Name:  "known-for",
			Usage: "Number of days you have known this user on keybase",
		},
	}
	cmd := &cmdWotVouch{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:        "vouch",
		Usage:       "Make a claim about another user",
		Description: "Make a claim about another user",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "vouch", c)
		},
		Flags: flags,
	}
}

func (c *cmdWotVouch) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *cmdWotVouch) Run() error {
	return nil
}

func (c *cmdWotVouch) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
