package main

import "github.com/maxtaco/go-framed-msgpack-rpc/rpc2"

type MykeyHandler struct {
	BaseHandler
}

func NewMykeyHandler(xp *rpc2.Transport) *MykeyHandler {
	return &MykeyHandler{BaseHandler{xp: xp}}
}
