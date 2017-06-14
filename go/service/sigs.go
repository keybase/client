// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

// SigsHandler is the RPC handler for the sigs interface.
type SigsHandler struct {
	*BaseHandler
	libkb.Contextified
}

// NewSigsHandler creates a SigsHandler for the xp transport.
func NewSigsHandler(xp rpc.Transporter, g *libkb.GlobalContext) *SigsHandler {
	return &SigsHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *SigsHandler) SigList(_ context.Context, arg keybase1.SigListArg) ([]keybase1.Sig, error) {
	eng, err := h.run(arg.Arg)
	if err != nil {
		return nil, err
	}
	return eng.Sigs(), nil
}

func (h *SigsHandler) SigListJSON(_ context.Context, arg keybase1.SigListJSONArg) (string, error) {
	eng, err := h.run(arg.Arg)
	if err != nil {
		return "", err
	}
	return eng.JSON()
}

func (h *SigsHandler) run(args keybase1.SigListArgs) (*engine.SigsList, error) {
	ctx := &engine.Context{}

	ea := engine.SigsListArgs{
		Username: args.Username,
		Filterx:  args.Filterx,
		Verbose:  args.Verbose,
		Revoked:  args.Revoked,
		Types:    nil,
	}
	if args.Types != nil {
		t := make(map[string]bool)
		f := func(v bool, name string) {
			if v {
				t[name] = true
			}
		}
		f(args.Types.Track, "track")
		f(args.Types.Proof, "proof")
		f(args.Types.Cryptocurrency, "cryptocurrency")
		f(args.Types.IsSelf, "self")
		ea.Types = t
	}
	eng := engine.NewSigsList(ea, h.G())
	if err := engine.RunEngine(eng, ctx); err != nil {
		return nil, err
	}
	return eng, nil
}
