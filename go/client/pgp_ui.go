// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	humanize "github.com/dustin/go-humanize"
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type PgpUI struct {
	parent *UI
}

func NewPgpUIProtocol(g *libkb.GlobalContext) rpc.Protocol {
	return keybase1.PGPUiProtocol(g.UI.GetPgpUI())
}

func (p PgpUI) OutputSignatureSuccess(_ context.Context, arg keybase1.OutputSignatureSuccessArg) error {
	signedAt := keybase1.FromTime(arg.SignedAt)
	if signedAt.IsZero() {
		p.parent.Printf("Signature verified. Signed by %s.\n", arg.Username)
	} else {
		p.parent.Printf("Signature verified. Signed by %s %s (%s).\n", arg.Username, humanize.Time(signedAt), signedAt)
	}
	p.parent.Printf("PGP Fingerprint: %s.\n", arg.Fingerprint)
	return nil
}
