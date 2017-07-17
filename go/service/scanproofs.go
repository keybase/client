// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type ScanProofsHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewScanProofsHandler(xp rpc.Transporter, g *libkb.GlobalContext) *ScanProofsHandler {
	return &ScanProofsHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

// ScanProofs creates a ScanProofsEngine and runs it.
func (h *ScanProofsHandler) ScanProofs(_ context.Context, arg keybase1.ScanProofsArg) error {
	ctx := engine.Context{
		LogUI:     h.getLogUI(arg.SessionID),
		SessionID: arg.SessionID,
	}
	eng := engine.NewScanProofsEngine(arg.Infile, arg.Indices, arg.Sigid, arg.Ratelimit, arg.Cachefile, arg.Ignorefile, h.G())
	return engine.RunEngine(eng, &ctx)
}
