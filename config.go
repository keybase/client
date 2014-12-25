package main

import (
	"github.com/keybase/go-libkb"
	"github.com/keybase/protocol/go"
	"net"
)

type ConfigHandler struct {
	conn net.Conn
}

func (h ConfigHandler) GetCurrentStatus(arg *keybase_1.GetCurrentStatusArg, res *keybase_1.GetCurrentStatusRes) error {
	cs, err := libkb.GetCurrentStatus()
	res.Status = libkb.ExportErrorAsStatus(err)
	if err == nil {
		body := keybase_1.GetCurrentStatusResBody{
			Configured:        cs.Configured,
			Registered:        cs.Registered,
			LoggedIn:          cs.LoggedIn,
			PublicKeySelected: cs.PublicKeySelected,
		}
		res.Body = &body
	}
	return nil
}
