// Copyright 2015 Keybase, Inc. All rights reserved. Use of
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
	libkb.Contextified
	w io.Writer
}

func NewPgpUIProtocol(g *libkb.GlobalContext) rpc.Protocol {
	return keybase1.PGPUiProtocol(g.UI.GetPgpUI())
}

func (p PgpUI) OutputPGPWarning(_ context.Context, arg keybase1.OutputPGPWarningArg) error {
	_, _ = p.w.Write([]byte(ColorString(p.G(), "red", fmt.Sprintf("WARNING: %s\n", arg.Warning))))
	return nil
}

func (p PgpUI) OutputSignatureSuccess(ctx context.Context, arg keybase1.OutputSignatureSuccessArg) error {
	signedAt := keybase1.FromTime(arg.SignedAt)
	un := ColorString(p.G(), "bold", arg.Username)
	output := func(fmtString string, args ...interface{}) {
		s := fmt.Sprintf(fmtString, args...)
		s = ColorString(p.G(), "green", s)
		_, _ = p.w.Write([]byte(s))
	}

	for _, warning := range arg.Warnings {
		if err := p.OutputPGPWarning(ctx, keybase1.OutputPGPWarningArg{
			SessionID: arg.SessionID,
			Warning:   warning,
		}); err != nil {
			return err
		}
	}

	if signedAt.IsZero() {
		output("Signature verified. Signed by %s.\n", un)
	} else {
		output("Signature verified. Signed by %s %s (%s).\n", un, humanize.Time(signedAt), signedAt)
	}
	output("PGP Fingerprint: %s.\n", arg.Fingerprint)
	return nil
}

func (p PgpUI) OutputSignatureNonKeybase(ctx context.Context, arg keybase1.OutputSignatureNonKeybaseArg) error {
	signedAt := keybase1.FromTime(arg.SignedAt)
	output := func(fmtString string, args ...interface{}) {
		s := fmt.Sprintf(fmtString, args...)
		s = ColorString(p.G(), "red", s)
		_, _ = p.w.Write([]byte(s))
	}

	for _, warning := range arg.Warnings {
		if err := p.OutputPGPWarning(ctx, keybase1.OutputPGPWarningArg{
			SessionID: arg.SessionID,
			Warning:   warning,
		}); err != nil {
			return err
		}
	}

	if signedAt.IsZero() {
		output("Message signed by key %s (unknown to Keybase).\n", arg.KeyID)
	} else {
		output("Message signed by key %s (unknown to Keybase) %s (%s).\n", arg.KeyID, humanize.Time(signedAt), signedAt)
	}

	return nil
}
func (p PgpUI) KeyGenerated(ctx context.Context, arg keybase1.KeyGeneratedArg) error {
	return nil
}

func (p PgpUI) ShouldPushPrivate(ctx context.Context, arg keybase1.ShouldPushPrivateArg) (bool, error) {
	return false, nil
}

func (p PgpUI) Finished(ctx context.Context, sessionID int) error {
	return nil
}
