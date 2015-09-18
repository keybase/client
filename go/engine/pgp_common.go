package engine

import (
	"time"

	"github.com/dustin/go-humanize"
	"github.com/keybase/client/go/libkb"
)

// OutputSignatureSuccess prints the details of a successful verification.
func OutputSignatureSuccess(ctx *Context, fingerprint libkb.PGPFingerprint, owner *libkb.User, signatureTime time.Time) {
	if signatureTime.IsZero() {
		ctx.LogUI.Notice("Signature verified. Signed by %s.", owner.GetName())
	} else {
		ctx.LogUI.Notice("Signature verified. Signed by %s %s (%s).", owner.GetName(), humanize.Time(signatureTime), signatureTime)
	}
	ctx.LogUI.Notice("PGP Fingerprint: %s.", fingerprint)
}
