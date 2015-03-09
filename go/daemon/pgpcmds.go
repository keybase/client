package main

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type PGPCmdsHandler struct {
	BaseHandler
}

func NewPGPCmdsHandler(xp *rpc2.Transport) *PGPCmdsHandler {
	return &PGPCmdsHandler{BaseHandler{xp: xp}}
}

func (h *PGPCmdsHandler) PgpSign(arg keybase_1.PgpSignArg) (err error) {
	cli := h.getStreamUICli()
	src := libkb.RemoteStream{Stream: arg.Source, Cli: cli}
	snk := libkb.RemoteStream{Stream: arg.Sink, Cli: cli}
	sessionID := arg.SessionID

	earg := engine.PGPCmdSignArg{
		PGPCmdBaseArg: engine.PGPCmdBaseArg{
			Sink:   snk,
			Source: src,
		},
		Binary:   arg.Binary,
		KeyQuery: arg.KeyQuery,
	}

	ctx := engine.Context{
		SecretUI: h.getSecretUI(sessionID),
	}

	eng := engine.NewPGPCmdSignEngine(&earg)

	return engine.RunEngine(eng, &ctx, nil, nil)
}
