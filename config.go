package main

import (
	"github.com/keybase/go-libkb"
	"github.com/keybase/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type ConfigHandler struct {
	xp *rpc2.Transport
}

func (h ConfigHandler) GetCurrentStatus() (res keybase_1.GetCurrentStatusRes, err error) {
	var cs libkb.CurrentStatus
	cs, err = libkb.GetCurrentStatus()
	if err == nil {
		res.Configured =        cs.Configured
		res.Registered =        cs.Registered
		res.LoggedIn =          cs.LoggedIn
		res.PublicKeySelected = cs.PublicKeySelected
	}
	return
}
