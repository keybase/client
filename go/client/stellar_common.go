package client

import (
	"fmt"
	"os"
	"strings"

	"github.com/keybase/client/go/stellar"
	"github.com/keybase/client/go/terminalescaper"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	isatty "github.com/mattn/go-isatty"
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
)

func printPayment(g *libkb.GlobalContext, p stellar1.PaymentCLILocal, verbose bool, dui libkb.DumbOutputUI) {
	lineUnescaped := func(format string, args ...interface{}) {
		dui.PrintfUnescaped(format+"\n", args...)
	}
	line := func(format string, args ...interface{}) {
		dui.Printf(format+"\n", args...)
	}
	timeStr := p.Time.Time().Format("2006/01/02 15:04")
	if p.Unread {
		timeStr += " *"
	}
	lineUnescaped("%v", ColorString(g, "bold", timeStr))

	// if path payment, show the source asset amount
	if p.SourceAmountActual != "" {
		sourceAmount, err := stellar.FormatAmountDescriptionAssetEx(libkb.NewMetaContext(context.Background(), g), p.SourceAmountActual, p.SourceAsset)
		if err != nil {
			lineUnescaped("%v %s", ColorString(g, "red", "Error while formatting amount:"), err)
		} else {
			lineUnescaped("%v", ColorString(g, "yellow", sourceAmount))
		}
	}

	// destination amount, asset
	amount, err := stellar.FormatAmountDescriptionAssetEx(libkb.NewMetaContext(context.Background(), g), p.Amount, p.Asset)
	if err == nil {
		if p.DisplayAmount != nil && p.DisplayCurrency != nil && len(*p.DisplayAmount) > 0 && len(*p.DisplayAmount) > 0 {
			amount = fmt.Sprintf("%v %v (%v)", *p.DisplayAmount, *p.DisplayCurrency, amount)
		}
	} else {
		lineUnescaped("%v %s", ColorString(g, "red", "Error while formatting amount:"), err)
	}
	lineUnescaped("%v", ColorString(g, "green", amount))

	// Show sender and recipient. Prefer keybase form, fall back to stellar abbreviations.
	var showedAbbreviation bool
	var from string
	switch {
	case p.FromUsername != nil:
		from = *p.FromUsername
	default:
		from = p.FromStellar.LossyAbbreviation()
		showedAbbreviation = true
	}
	var to string
	switch {
	case p.ToUsername != nil && p.ToAssertion != nil && (*p.ToUsername != *p.ToAssertion):
		to = fmt.Sprintf("%s (%q)", *p.ToUsername, *p.ToAssertion)
	case p.ToUsername != nil:
		to = *p.ToUsername
	case p.ToStellar != nil:
		to = p.ToStellar.LossyAbbreviation()
		showedAbbreviation = true
	case p.ToAssertion != nil:
		to = fmt.Sprintf("%q", *p.ToAssertion)
	default:
		// This should never happen
		lineUnescaped("%v", ColorString(g, "red", "missing recipient info"))
	}
	line("%v -> %v", from, to)
	if showedAbbreviation || verbose {
		// If an abbreviation was shown, show the full addresses. We could skip
		// the "%v -> %v" line above if both `to` and `from` are address IDs,
		// because we are printing full IDs anyway, but it serves an important
		// purpose of telling user that that the entire transfer happened
		// outside of Keybase.
		line("From: %v", p.FromStellar.String())
		if p.ToStellar != nil {
			line("To:   %v", p.ToStellar.String())
		} else {
			lineUnescaped("To:   %v", ColorString(g, "yellow", "unclaimed"))
		}
	}
	if g.Env.GetDisplayRawUntrustedOutput() || !isatty.IsTerminal(os.Stdout.Fd()) {
		if len(p.Note) > 0 {
			lineUnescaped("Note: %v", ColorString(g, "yellow", printPaymentFilterNote(p.Note)))
		}
		if len(p.NoteErr) > 0 {
			lineUnescaped("Note Error: %v", ColorString(g, "red", p.NoteErr))
		}
	} else {
		if len(p.Note) > 0 {
			lineUnescaped("Note: %v", ColorString(g, "yellow", printPaymentFilterNote(terminalescaper.Clean(p.Note))))
		}
		if len(p.NoteErr) > 0 {
			lineUnescaped("Note Error: %v", ColorString(g, "red", terminalescaper.Clean(p.NoteErr)))
		}
	}
	if verbose {
		line("Transaction Hash: %v", p.TxID)
	}
	switch {
	case p.Status == "":
	case cicmp(p.Status, "completed"):
	default:
		color := "red"
		if cicmp(p.Status, "claimable") {
			color = "yellow"
		}
		lineUnescaped("Status: %v", ColorString(g, color, p.Status))
		lineUnescaped("        %v", ColorString(g, color, p.StatusDetail))
	}
}

// printPaymentFilterNote: Pare down the note so that it's less likely to contain tricks.
// Such as newlines and fake transactions.
// Shows only the first line.
func printPaymentFilterNote(note string) string {
	lines := strings.Split(strings.TrimSpace(note), "\n")
	if len(lines) < 1 {
		return ""
	}
	return strings.TrimSpace(lines[0])
}

func cicmp(a, b string) bool {
	return strings.ToLower(a) == strings.ToLower(b)
}

func transformStellarCLIError(err *error) {
	if err == nil {
		return
	}
	switch e := (*err).(type) {
	case libkb.AppStatusError:
		if e.Code == libkb.SCStellarNeedDisclaimer {
			*err = libkb.NewAppStatusError(&libkb.AppStatus{
				Code: e.Code,
				Name: e.Name,
				Desc: "Stellar disclaimer not yet accepted. Run 'keybase wallet get-started'",
			})
		}
	}
}

// runPathPayment called by cmd_wallet_send_path_payment and cmd_wallet_handle_uri.
func runPathPayment(g *libkb.GlobalContext, findArg stellar1.FindPaymentPathLocalArg, note string) (err error) {
	defer transformStellarCLIError(&err)

	cli, err := GetWalletClient(g)
	if err != nil {
		return err
	}

	protocols := []rpc.Protocol{
		NewIdentifyUIProtocol(g),
	}
	if err := RegisterProtocolsWithContext(protocols, g); err != nil {
		return err
	}

	ui := g.UI.GetTerminalUI()

	ui.Printf(ColorString(g, "yellow", "Searching for payment path for %s to %s...\n", findArg.SourceAsset, findArg.DestinationAsset))
	path, err := cli.FindPaymentPathLocal(context.Background(), findArg)
	if err != nil {
		return err
	}

	// TODO: when SourceDisplay, SourceMaxDisplay, DestinationDisplay filled in, use those
	ui.Printf("Sending approximately %s of %s (at most %s)\n", path.FullPath.SourceAmount, path.FullPath.SourceAsset, path.FullPath.SourceAmountMax)
	ui.Printf("User %s will receive %s of %s\n\n", findArg.To, path.FullPath.DestinationAmount, path.FullPath.DestinationAsset)

	if err := ui.PromptForConfirmation("Proceed?"); err != nil {
		return err
	}

	ui.Printf(ColorString(g, "yellow", "Submitting transaction to the Stellar network..."))
	sendArg := stellar1.SendPathCLILocalArg{
		Source:    findArg.From,
		Recipient: findArg.To,
		Path:      path.FullPath,
		Note:      note,
	}
	res, err := cli.SendPathCLILocal(context.Background(), sendArg)
	if err != nil {
		return err
	}

	ui.Printf("Sent!\nKeybase Transaction ID: %v\nStellar Transaction ID: %v\n", res.KbTxID, res.TxID)
	return nil
}
