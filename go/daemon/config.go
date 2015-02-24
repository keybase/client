package main

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type ConfigHandler struct {
	xp *rpc2.Transport
}

func (h ConfigHandler) GetCurrentStatus() (res keybase_1.GetCurrentStatusRes, err error) {
	var cs libkb.CurrentStatus
	if cs, err = libkb.GetCurrentStatus(); err == nil {
		res = cs.Export()
	}
	return
}
