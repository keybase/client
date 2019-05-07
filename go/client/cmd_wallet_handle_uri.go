package client

import (
	"errors"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
)

type CmdWalletHandleURI struct {
	libkb.Contextified
	uri string
}

func newCmdWalletHandleURI(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdWalletHandleURI{
		Contextified: libkb.NewContextified(g),
	}

	return cli.Command{
		Name:         "handle-uri",
		Usage:        "Handle a 'web+stellar:' URI manually",
		ArgumentHelp: "<uri>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "handle-uri", c)
		},
	}
}

func (c *CmdWalletHandleURI) ParseArgv(ctx *cli.Context) error {
	c.uri = ctx.Args().First()
	if c.uri == "" {
		return errors.New("uri required")
	}

	return nil
}

func (c *CmdWalletHandleURI) Run() (err error) {
	defer transformStellarCLIError(&err)

	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}

	protocols := []rpc.Protocol{
		NewIdentifyUIProtocol(c.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	ui := c.G().UI.GetTerminalUI()

	ui.Printf(c.yellow("Validating URI...") + "\n")
	arg := stellar1.ValidateStellarURILocalArg{
		InputURI: c.uri,
	}
	v, err := cli.ValidateStellarURILocal(context.Background(), arg)
	if err != nil {
		return err
	}

	ui.Printf(c.green("URI validated.") + "\n\n")
	ui.Printf("Keybase validated the URI you submitted.  It was signed by\n\n")
	ui.Printf("\t%s\n\n", ColorString(c.G(), "underline", v.OriginDomain))
	if v.Message != "" {
		ui.Printf("Message: %q\n\n", v.Message)
	}

	if v.Operation == "pay" {
		ui.Printf("The URI is requesting that you pay\n\n")
		if v.Amount != "" {
			ui.Printf("\t%s ", c.green(v.Amount))
			if v.AssetCode != "" {
				ui.Printf("%s/%s", c.green(v.AssetCode), v.AssetIssuer)
			} else {
				ui.Printf(c.green("XLM"))
			}
			ui.Printf(" to:\n")
		}
		ui.Printf("\t%s\n\n", v.Recipient)
		if v.Amount == "" {
			// XXX prompt for amount
		}

		if v.CallbackURL == "" {
			ui.Printf("If you confirm this request, Keybase will create a payment\n")
			ui.Printf("transaction, sign it with your primary account, and submit it\n")
			ui.Printf("to the Stellar network.\n\n")

			if err := ui.PromptForConfirmation(fmt.Sprintf("Send %s to %s?", c.green(v.Amount), c.yellow(v.Recipient))); err != nil {
				return err
			}
		} else {
			ui.Printf("If you confirm this request, Keybase will create a payment\n")
			ui.Printf("transaction, sign it with your primary account, and send it\n")
			ui.Printf("to the following URL for processing:\n")
			ui.Printf("\t%s\n\n", v.CallbackURL)
			ui.Printf("(this was specified in the request).\n")
		}
		// XXX prompt for proceed
	} else if v.Operation == "tx" {

	} else {
		// shouldn't happen since this is validated by service, but in case:
		ui.Printf("Sorry, Keybase doesn't handle URIs with operation %q.", v.Operation)
		return nil
	}

	return nil
}

func (c *CmdWalletHandleURI) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}

func (c *CmdWalletHandleURI) green(s string) string {
	return ColorString(c.G(), "green", s)
}

func (c *CmdWalletHandleURI) yellow(s string) string {
	return ColorString(c.G(), "yellow", s)
}
