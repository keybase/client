// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"io"

	humanize "github.com/dustin/go-humanize"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type PgpUI struct {
	w io.Writer
}

func NewPgpUIProtocol(g *libkb.GlobalContext) rpc.Protocol {
	return keybase1.PGPUiProtocol(g.UI.GetPgpUI())
}

func (p PgpUI) OutputSignatureSuccess(_ context.Context, arg keybase1.OutputSignatureSuccessArg) error {
	signedAt := keybase1.FromTime(arg.SignedAt)
	un := ColorString("bold", arg.Username)
	output := func(fmtString string, args ...interface{}) {
		s := fmt.Sprintf(fmtString, args...)
		s = ColorString("green", s)
		p.w.Write([]byte(s))
	}

	if signedAt.IsZero() {
		output("Signature verified. Signed by %s.\n", un)
	} else {
		output("Signature verified. Signed by %s %s (%s).\n", un, humanize.Time(signedAt), signedAt)
	}
	output("PGP Fingerprint: %s.\n", arg.Fingerprint)
	return nil
}

func (p PgpUI) OutputSignatureSuccessNonKeybase(ctx context.Context, arg keybase1.OutputSignatureSuccessNonKeybaseArg) error {
	signedAt := keybase1.FromTime(arg.SignedAt)
	output := func(fmtString string, args ...interface{}) {
		s := fmt.Sprintf(fmtString, args...)
		s = ColorString("green", s)
		p.w.Write([]byte(s))
	}

	if signedAt.IsZero() {
		output("Signature verified. Signed by key %s (unknown to keybase).\n", arg.KeyID)
	} else {
		output("Signature verified. Signed by key %s (unknown to keybase) %s (%s).\n", arg.KeyID, humanize.Time(signedAt), signedAt)
	}
	return nil
}
func (p PgpUI) KeyGenerated(ctx context.Context, arg keybase1.KeyGeneratedArg) error {
	return nil
}

func (p PgpUI) ShouldPushPrivate(ctx context.Context, sessionID int) (bool, error) {
	return false, nil
}

func (p PgpUI) Finished(ctx context.Context, sessionID int) error {
	return nil
}
