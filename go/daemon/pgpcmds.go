package main

import (
	// "github.com/keybase/client/go/engine"
	// "github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type PGPCmdsHandler struct {
	BaseHandler
}

func NewPGPCmdsHandler(xp *rpc2.Transport) *PGPCmdsHandler {
	return &PGPCmdsHandler{BaseHandler{xp: xp}}
}

func (h *PGPCmdsHandler) PgpSign(arg keybase_1.PgpSignArg) (source keybase_1.AvdlFile, err error) {
	return
}
