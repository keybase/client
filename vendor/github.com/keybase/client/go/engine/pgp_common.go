// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

// OutputSignatureSuccess prints the details of a successful verification.
func OutputSignatureSuccess(ctx *Context, fingerprint libkb.PGPFingerprint, owner *libkb.User, signatureTime time.Time) {
	arg := keybase1.OutputSignatureSuccessArg{
		Fingerprint: fingerprint.String(),
		Username:    owner.GetName(),
		SignedAt:    keybase1.TimeFromSeconds(signatureTime.Unix()),
	}
	ctx.PgpUI.OutputSignatureSuccess(context.TODO(), arg)
}
