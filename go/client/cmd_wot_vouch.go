package client

import (
	"errors"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

type cmdWotVouch struct {
	assertion  string
	message    string
	confidence keybase1.Confidence
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
		cli.StringFlag{
			Name:  "other",
			Usage: "Other information about your confidence in knowing this user",
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
	if len(ctx.Args()) != 1 {
		return errors.New("vouch requires a user assertion argument")
	}
	c.assertion = ctx.Args()[0]
	c.message = ctx.String("message")
	kf := ctx.Int("known-for")
	if kf > 0 {
		c.confidence.KnownOnKeybaseDays = kf
	}
	via := ctx.String("verified-via")
	if via != "" {
		viaType, ok := keybase1.UsernameVerificationTypeMap[strings.ToUpper(via)]
		if !ok {
			return errors.New("invalid verified-via option")
		}
		c.confidence.UsernameVerifiedVia = viaType
	}
	c.confidence.VouchedBy = strings.Split(ctx.String("vouched-by"), ",")
	c.confidence.Other = ctx.String("other")

	return nil
}

func (c *cmdWotVouch) Run() error {
	arg := keybase1.WotVouchCLIArg{
		Assertion:    c.assertion,
		Attestations: []string{c.message},
		Confidence:   c.confidence,
	}

	cli, err := GetWebOfTrustClient(c.G())
	if err != nil {
		return err
	}
	return cli.WotVouchCLI(context.Background(), arg)
}

func (c *cmdWotVouch) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
