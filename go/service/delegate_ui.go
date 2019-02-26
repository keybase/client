// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
)

// DelegateUICtlHandler is the RPC handler for notify control messages
type DelegateUICtlHandler struct {
	libkb.Contextified
	*BaseHandler
	id          libkb.ConnectionID
	rekeyMaster *rekeyMaster
}

// NewDelegateUICtlHandler creates a new handler for setting up notification
// channels
func NewDelegateUICtlHandler(xp rpc.Transporter, id libkb.ConnectionID, g *libkb.GlobalContext, rekeyMaster *rekeyMaster) *DelegateUICtlHandler {
	return &DelegateUICtlHandler{
		Contextified: libkb.NewContextified(g),
		BaseHandler:  NewBaseHandler(g, xp),
		id:           id,
		rekeyMaster:  rekeyMaster,
	}
}

func (d *DelegateUICtlHandler) RegisterIdentifyUI(ctx context.Context) error {
	d.G().UIRouter.SetUI(d.id, libkb.IdentifyUIKind)
	d.pushGregorIdentifyUIHandler(ctx)
	return nil
}

func (d *DelegateUICtlHandler) RegisterIdentify3UI(ctx context.Context) error {
	d.G().UIRouter.SetUI(d.id, libkb.Identify3UIKind)
	d.pushGregorIdentifyUIHandler(ctx)
	return nil
}

func (d *DelegateUICtlHandler) pushGregorIdentifyUIHandler(_ context.Context) {
	if d.G().GregorListener == nil {
		return
	}

	// Let Gregor related code know that a IdentifyUI client
	// (probably Electron) has connected, and to sync out state to it
	d.G().GregorListener.PushHandler(NewIdentifyUIHandler(d.G(), d.id))
}

func (d *DelegateUICtlHandler) RegisterChatUI(_ context.Context) error {
	d.G().UIRouter.SetUI(d.id, libkb.ChatUIKind)
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

func (d *DelegateUICtlHandler) RegisterHomeUI(_ context.Context) error {
	d.G().UIRouter.SetUI(d.id, libkb.HomeUIKind)
	return nil
}

func (d *DelegateUICtlHandler) RegisterGregorFirehose(ctx context.Context) error {
	return d.registerGregorFirehose(ctx, nil)
}

func (d *DelegateUICtlHandler) RegisterGregorFirehoseFiltered(ctx context.Context, oobmSystems []string) error {
	return d.registerGregorFirehose(ctx, oobmSystems)
}

func (d *DelegateUICtlHandler) registerGregorFirehose(ctx context.Context, oobmSystems []string) error {
	if d.G().GregorListener != nil {
		d.G().Log.Debug("Registering firehose on connection %d", d.id)
		d.G().GregorListener.PushFirehoseHandler(newGregorFirehoseHandler(d.G(), d.id, d.xp, oobmSystems))
	} else {
		d.G().Log.Info("Failed to register firehose on connection %d", d.id)
	}
	return nil
}

func (d *DelegateUICtlHandler) RegisterRekeyUI(_ context.Context) error {
	d.G().UIRouter.SetUI(d.id, libkb.RekeyUIKind)
	if d.rekeyMaster != nil {
		d.rekeyMaster.newUIRegistered()
	}
	return nil
}
