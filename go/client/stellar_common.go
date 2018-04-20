package client

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
)

func printPayment(g *libkb.GlobalContext, p stellar1.PaymentCLILocal, verbose bool, dui libkb.DumbOutputUI) {
	line := func(format string, args ...interface{}) {
		dui.Printf(format+"\n", args...)
	}
	timeStr := p.Time.Time().Format("2006/01/02 15:04")
	line("%v", ColorString(g, "bold", timeStr))
	amount := fmt.Sprintf("%v XLM", libkb.StellarSimplifyAmount(p.Amount))
	if !p.Asset.IsNativeXLM() {
		amount = fmt.Sprintf("%v %v/%v", p.Amount, p.Asset.Code, p.Asset.Issuer)
	}
	if p.DisplayAmount != nil && p.DisplayCurrency != nil && len(*p.DisplayAmount) > 0 && len(*p.DisplayAmount) > 0 {
		amount = fmt.Sprintf("%v %v (%v)", *p.DisplayAmount, *p.DisplayCurrency, amount)
	}
	line("%v", ColorString(g, "green", amount))
	// Show sender and recipient. Prefer keybase form, fall back to stellar abbreviations.
	from := p.FromStellar.LossyAbbreviation()
	to := p.ToStellar.LossyAbbreviation()
	if p.FromUsername != nil {
		from = *p.FromUsername
	}
	if p.ToUsername != nil {
		to = *p.ToUsername
	}
	showedAbbreviation := true
	if p.FromUsername != nil && p.ToUsername != nil {
		showedAbbreviation = false
	}
	line("%v -> %v", from, to)
	// If an abbreviation was shown, show the full addresses
	if showedAbbreviation || verbose {
		line("From: %v", p.FromStellar.String())
		line("To:   %v", p.ToStellar.String())
	}
	if len(p.Note) > 0 {
		line("Note: %v", ColorString(g, "yellow", printPaymentFilterNote(p.Note)))
	}
	if len(p.NoteErr) > 0 {
		line("Note Error: %v", ColorString(g, "red", p.NoteErr))
	}
	if verbose {
		line("Transaction Hash: %v", p.StellarTxID)
	}
	if len(p.Status) > 0 && p.Status != "completed" {
		line("Status: %v", ColorString(g, "red", p.Status))
		line("        %v", ColorString(g, "red", p.StatusDetail))
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
