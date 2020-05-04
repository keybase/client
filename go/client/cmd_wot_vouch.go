package client

import (
	"errors"
	"fmt"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
)

type CmdWotVouch struct {
	Assertion  string
	Message    string
	Confidence keybase1.Confidence
	libkb.Contextified
}

// Keep in sync with wot.avdl
const verifiedViaChoices = "in_person, proofs, video, audio, other_chat, familiar, other"

func newCmdWotVouch(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := []cli.Flag{
		cli.StringFlag{
			Name:  "m, message",
			Usage: "A message about this user",
		},
		cli.StringFlag{
			Name:  "verified-via",
			Usage: fmt.Sprintf("How you verified their identity: %s", verifiedViaChoices),
		},
		cli.StringFlag{
			Name:  "other",
			Usage: "Other information about your confidence in knowing this user",
		},
	}
	cmd := &CmdWotVouch{
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

func (c *CmdWotVouch) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return errors.New("vouch requires a user assertion argument")
	}
	c.Assertion = ctx.Args()[0]
	c.Message = ctx.String("message")
	if len(c.Message) == 0 {
		return errors.New("vouch requires an attestation e.g. `-m \"Alice plays the banjo\"`")
	}
	via := ctx.String("verified-via")
	if via == "" {
		return errors.New("verified-via is required")
	}
	viaType, ok := keybase1.UsernameVerificationTypeMap[strings.ToLower(via)]
	if !ok {
		return fmt.Errorf("invalid verified-via value '%v'. Expected one of: %v", via, verifiedViaChoices)
	}
	c.Confidence.UsernameVerifiedVia = viaType
	other := ctx.String("other")
	if (other != "") != (c.Confidence.UsernameVerifiedVia == keybase1.UsernameVerificationType_OTHER) {
		return errors.New("--other must be paired with --verified-via 'other'")
	}
	if other != "" {
		c.Confidence.Other = ctx.String("other")
	}
	return nil
}

func (c *CmdWotVouch) Run() error {
	protocols := []rpc.Protocol{NewIdentifyUIProtocol(c.G())}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}
	arg := keybase1.WotVouchCLIArg{
		Assertion:  c.Assertion,
		VouchText:  c.Message,
		Confidence: c.Confidence,
	}
	cli, err := GetWebOfTrustClient(c.G())
	if err != nil {
		return err
	}
	return cli.WotVouchCLI(context.Background(), arg)
}

func (c *CmdWotVouch) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
