package main

import (
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
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

func (h ConfigHandler) GetConfig() (keybase_1.Config, error) {
	var c keybase_1.Config

	c.ServerURI = G.Env.GetServerUri()
	var err error
	c.SocketFile, err = G.Env.GetSocketFile()
	if err != nil {
		return c, err
	}

	gpg := G.GetGpgClient()
	canExec, err := gpg.CanExec()
	if err != nil {
		return c, err
	}
	c.GpgExists = canExec
	c.GpgPath = gpg.Path()

	return c, nil
}
