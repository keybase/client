// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"
	"github.com/keybase/client/go/libkb"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	context "golang.org/x/net/context"
)

// DelegateUICtlHandler is the RPC handler for notify control messages
type DelegateUICtlHandler struct {
	libkb.Contextified
	*BaseHandler
	id libkb.ConnectionID
}

// NewDelegateUICtlHandler creates a new handler for setting up notification
// channels
func NewDelegateUICtlHandler(xp rpc.Transporter, id libkb.ConnectionID, g *libkb.GlobalContext) *DelegateUICtlHandler {
	return &DelegateUICtlHandler{
		Contextified: libkb.NewContextified(g),
		BaseHandler:  NewBaseHandler(xp),
		id:           id,
	}
}

func (d *DelegateUICtlHandler) RegisterIdentifyUI(_ context.Context) error {
	fmt.Println("bbbbbbbcccc", d.G())
	fmt.Println("bbbbbbbcccc", d.G().UIRouter)
	d.G().UIRouter.SetUI(d.id, libkb.IdentifyUIKind)
	return nil
}

func (d *DelegateUICtlHandler) RegisterSecretUI(_ context.Context) error {
	d.G().UIRouter.SetUI(d.id, libkb.SecretUIKind)
	return nil
}

func (d *DelegateUICtlHandler) RegisterUpdateUI(_ context.Context) error {
	d.G().UIRouter.SetUI(d.id, libkb.UpdateUIKind)
	return nil
}
