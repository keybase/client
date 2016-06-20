// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
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
	d.G().UIRouter.SetUI(d.id, libkb.IdentifyUIKind)

	// Let Gregor related code know that a IdentifyUI client
	// (probably Electron) has connected, and to sync out state to it
	if d.G().GregorListener != nil {
		d.G().GregorListener.PushHandler(NewIdentifyUIHandler(d.G(), d.id))
	}

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

func (d *DelegateUICtlHandler) RegisterGregorFirehose(_ context.Context) error {
	if d.G().GregorListener != nil {
		d.G().Log.Debug("Registering firehose on connection %d", d.id)
		d.G().GregorListener.PushFirehoseHandler(newGregorFirehoseHandler(d.G(), d.id, d.xp))
	} else {
		d.G().Log.Info("Failed to register firehose on connection %d", d.id)
	}
	return nil
}

func (d *DelegateUICtlHandler) RegisterRekeyUI(_ context.Context) error {
	d.G().UIRouter.SetUI(d.id, libkb.RekeyUIKind)

	// Let Gregor related code know that a RekeyUI client
	// (probably Electron) has connected, and to sync out state to it
	if d.G().GregorListener != nil {
		d.G().GregorListener.PushHandler(NewRekeyUIHandler(d.G(), d.id))
	}
	return nil
}
