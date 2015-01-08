package main

import (
	"github.com/keybase/go-libkb"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type BaseHandler struct {
	xp  *rpc2.Transport
	cli *rpc2.Client
}

func (h *BaseHandler) getRpcClient() *rpc2.Client {
	if h.cli == nil {
		h.cli = rpc2.NewClient(h.xp, libkb.UnwrapError)
	}
	return h.cli
}
