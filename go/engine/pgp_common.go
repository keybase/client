// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// OutputSignatureSuccess prints the details of a successful verification.
func OutputSignatureSuccess(ctx *Context, fingerprint libkb.PGPFingerprint, owner *libkb.User, signatureTime time.Time) error {
	arg := keybase1.OutputSignatureSuccessArg{
		Fingerprint: fingerprint.String(),
		Username:    owner.GetName(),
		SignedAt:    keybase1.TimeFromSeconds(signatureTime.Unix()),
	}
	return ctx.PgpUI.OutputSignatureSuccess(ctx.GetNetContext(), arg)
}

// OutputSignatureSuccessNonKeybase prints the details of successful signature verification
// when signing key is not known to keybase.
func OutputSignatureSuccessNonKeybase(ctx *Context, keyID uint64, signatureTime time.Time) error {
	arg := keybase1.OutputSignatureSuccessNonKeybaseArg{
		KeyID:    fmt.Sprintf("%X", keyID),
		SignedAt: keybase1.TimeFromSeconds(signatureTime.Unix()),
	}
	return ctx.PgpUI.OutputSignatureSuccessNonKeybase(ctx.GetNetContext(), arg)
}
