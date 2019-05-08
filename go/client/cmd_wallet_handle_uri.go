package client

import (
	"errors"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/keybase/stellarnet"
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
	if v.Memo != "" {
		if v.MemoType == "MEMO_TEXT" {
			ui.Printf("Public memo: %q\n\n", v.Memo)
		} else {
			// CORE-10865 will remedy this situation...
			ui.Printf("Request contains a public memo with an unsupported type (%s): %q\n", v.MemoType, v.Memo)
			ui.Printf("At this time, Keybase does not support that memo type.\n")

			// shouldn't proceed if we can't include it in the transaction.
			return nil
		}
	}

	switch v.Operation {
	case "pay":
		return c.payOp(v)
	case "tx":
		return c.txOp(v)
	default:
		// shouldn't happen since v.Operation was validated by the service, but in case:
		ui.Printf("Sorry, Keybase doesn't handle URIs with operation %q.", v.Operation)
	}

	return nil
}

func (c *CmdWalletHandleURI) payOp(v stellar1.ValidateStellarURIResultLocal) error {
	ui := c.G().UI.GetTerminalUI()
	ui.Printf("The URI is requesting that you pay\n\n")
	assetDisplay := "XLM"
	if v.AssetCode != "" {
		assetDisplay = fmt.Sprintf("%s/%s", v.AssetCode, v.AssetIssuer)
	}
	if v.Amount != "" {
		ui.Printf("\t%s %s", c.green(v.Amount), c.green(assetDisplay))
		ui.Printf(" to:\n")
	}
	ui.Printf("\t%s\n\n", v.Recipient)
	if v.Amount == "" {
		ui.Printf("There is no amount specified in the request.\n")
		ui.Printf("The asset requested is\n\n\t%s\n\n", c.green(assetDisplay))
		amount, err := ui.Prompt(PromptDescriptorStellarURIAmount, fmt.Sprintf("How much %s would you like the recipient to receive?  ", assetDisplay))
		if err != nil {
			return err
		}
		if _, err := stellarnet.ParseStellarAmount(amount); err != nil {
			return err
		}
		v.Amount = amount
	}

	if v.CallbackURL == "" {
		ui.Printf("\nIf you confirm this request, Keybase will create a payment\n")
		ui.Printf("transaction, sign it with your primary account, and submit it\n")
		ui.Printf("to the Stellar network.\n\n")

		if err := ui.PromptForConfirmation(fmt.Sprintf("Send %s %s to %s?", c.green(v.Amount), c.green(assetDisplay), c.yellow(v.Recipient))); err != nil {
			return err
		}
	} else {
		ui.Printf("\nIf you confirm this request, Keybase will create a payment\n")
		ui.Printf("transaction, sign it with your primary account, and send it\n")
		ui.Printf("to the following URL for processing:\n")
		ui.Printf("\t%s\n\n", v.CallbackURL)
		ui.Printf("Note: Keybase will NOT be submitting the transaction to the Stellar\n")
		ui.Printf("network and does not know what will happen to it after sending\n")
		ui.Printf("it to the URL above.\n")

		if err := ui.PromptForConfirmation(fmt.Sprintf("Sign transaction to pay %s %s to %s and send it to the URL above?", c.green(v.Amount), c.green(assetDisplay), c.yellow(v.Recipient), v.CallbackURL)); err != nil {
			return err
		}
	}

	// user approved the operation, so proceed
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

	if v.CallbackURL == "" {
		if v.AssetCode == "" {
			arg := stellar1.SendCLILocalArg{
				Recipient:  v.Recipient,
				Amount:     v.Amount,
				Asset:      stellar1.AssetNative(),
				PublicNote: v.Memo,
			}
			res, err := cli.SendCLILocal(context.Background(), arg)
			if err != nil {
				return err
			}
			ui.Printf("Sent!\nKeybase Transaction ID: %v\nStellar Transaction ID: %v\n", res.KbTxID, res.TxID)
		} else {

		}

	} else {

	}

	return nil
}

func (c *CmdWalletHandleURI) txOp(v stellar1.ValidateStellarURIResultLocal) error {
	return errors.New("tx not handled yet")
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
