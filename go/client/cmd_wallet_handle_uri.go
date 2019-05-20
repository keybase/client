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
		ui.Printf("Public memo: %q\n\n", v.Memo)
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
		ui.Printf("to the following URL for processing:\n\n")
		ui.Printf("\t%s\n\n", v.CallbackURL)
		ui.Printf("Note: Keybase will NOT be submitting the transaction to the Stellar\n")
		ui.Printf("network and does not know what will happen to it after sending\n")
		ui.Printf("it to the URL above.\n")

		if err := ui.PromptForConfirmation(fmt.Sprintf("Sign transaction to pay %s %s to %s and send it to the URL above?", c.green(v.Amount), c.green(assetDisplay), c.yellow(v.Recipient))); err != nil {
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

	if v.AssetCode == "" {
		arg := stellar1.ApprovePayURILocalArg{
			InputURI: c.uri,
			Amount:   v.Amount,
			FromCLI:  true,
		}
		txID, err := cli.ApprovePayURILocal(context.Background(), arg)
		if err != nil {
			return err
		}

		if v.CallbackURL == "" {
			ui.Printf("Signed transaction sent to %s\n", v.CallbackURL)
		}
		ui.Printf("Sent!\nStellar Transaction ID: %v\n", txID)
	} else {
		// find a path payment so user can confirm it is ok
		arg := stellar1.FindPaymentPathLocalArg{
			To:     v.Recipient,
			Amount: v.Amount,
			DestinationAsset: stellar1.Asset{
				Code:   v.AssetCode,
				Issuer: v.AssetIssuer,
			},
		}
		ui.Printf(c.yellow(fmt.Sprintf("Searching for payment path to %s...", arg.DestinationAsset)) + "\n")
		path, err := cli.FindPaymentPathLocal(context.Background(), arg)
		if err != nil {
			return err
		}

		ui.Printf("Sending approximately %s of %s (at most %s)\n", path.FullPath.SourceAmount, path.FullPath.SourceAsset, path.FullPath.SourceAmountMax)
		ui.Printf("Account %s will receive %s of %s\n\n", arg.To, path.FullPath.DestinationAmount, path.FullPath.DestinationAsset)

		if err := ui.PromptForConfirmation("Proceed?"); err != nil {
			return err
		}

		approveArg := stellar1.ApprovePathURILocalArg{
			InputURI: c.uri,
			FullPath: path.FullPath,
			FromCLI:  true,
		}
		txID, err := cli.ApprovePathURILocal(context.Background(), approveArg)
		if err != nil {
			return err
		}
		if v.CallbackURL == "" {
			ui.Printf("Signed transaction sent to %s\n", v.CallbackURL)
		}
		ui.Printf("Sent!\nStellar Transaction ID: %v\n", txID)
	}

	return nil
}

func (c *CmdWalletHandleURI) txOp(v stellar1.ValidateStellarURIResultLocal) error {
	ui := c.G().UI.GetTerminalUI()
	ui.Printf("The URI is requesting that you sign a transaction.\n\n")
	ui.Printf("Here is the base64-encoded transaction envelope:\n\n")
	ui.Printf("\t%s\n\n", v.Xdr)
	ui.Printf("Transaction summary:\n\n")
	if v.Summary.Source != "" {
		ui.Printf("\tSource account: %s\n", v.Summary.Source)
	}
	if v.Summary.Fee > 0 {
		ui.Printf("\tFee: %d stroops\n", v.Summary.Fee)
	}
	if v.Summary.Memo != "" {
		ui.Printf("\tMemo: %q (%s)\n", v.Summary.Memo, v.Summary.MemoType)
	}
	ui.Printf("\tOperations: %d\n", len(v.Summary.Operations))
	for _, op := range v.Summary.Operations {
		ui.Printf("\t\t%s\n", op)
	}
	ui.Printf("\n")

	if v.CallbackURL == "" {
		ui.Printf("If you confirm this request, Keybase will sign this transaction\n")
		ui.Printf("with your primary account, and submit it to the Stellar network.\n\n")
		if err := ui.PromptForConfirmation("Sign this transaction and submit it to the Stellar network?"); err != nil {
			return err
		}
	} else {
		ui.Printf("If you confirm this request, Keybase will sign this transaction\n")
		ui.Printf("with your primary account, and send it to the following URL\n")
		ui.Printf("for processing:\n\n")
		ui.Printf("\t%s\n\n", v.CallbackURL)
		ui.Printf("Note: Keybase will NOT be submitting the transaction to the Stellar\n")
		ui.Printf("network and does not know what will happen to it after sending\n")
		ui.Printf("it to the URL above.\n")
		if err := ui.PromptForConfirmation("Sign this transaction and submit it to the URL above?"); err != nil {
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

	arg := stellar1.ApproveTxURILocalArg{
		InputURI: c.uri,
	}
	txID, err := cli.ApproveTxURILocal(context.Background(), arg)
	if err != nil {
		return err
	}
	ui.Printf(c.green("Success!") + "\n")
	if v.CallbackURL == "" {
		ui.Printf("Transaction submitted to Stellar network, transaction ID: %s\n", txID)
	} else {
		ui.Printf("Transaction sent to %s, transaction ID: %s\n", v.CallbackURL, txID)
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
