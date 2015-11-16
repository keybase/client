// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type KBFSHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewKBFSHandler(xp rpc.Transporter, g *libkb.GlobalContext) *KBFSHandler {
	return &KBFSHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *KBFSHandler) Encrypting(_ context.Context, arg keybase1.EncryptingArg) error {
	h.G().NotifyRouter.HandleFSActivity(
		keybase1.FSNotification{
			TopLevelFolder:   arg.TopLevelFolder,
			Filename:         arg.Filename,
			NotificationType: keybase1.FSNotificationType_ENCRYPTING,
		})
	return nil
}

func (h *KBFSHandler) Decrypting(_ context.Context, arg keybase1.DecryptingArg) error {
	h.G().NotifyRouter.HandleFSActivity(
		keybase1.FSNotification{
			TopLevelFolder:   arg.TopLevelFolder,
			Filename:         arg.Filename,
			NotificationType: keybase1.FSNotificationType_DECRYPTING,
		})
	return nil
}

func (h *KBFSHandler) Signing(_ context.Context, arg keybase1.SigningArg) error {
	h.G().NotifyRouter.HandleFSActivity(
		keybase1.FSNotification{
			TopLevelFolder:   arg.TopLevelFolder,
			Filename:         arg.Filename,
			NotificationType: keybase1.FSNotificationType_SIGNING,
		})
	return nil
}

func (h *KBFSHandler) Rekeying(_ context.Context, arg keybase1.RekeyingArg) error {
	h.G().NotifyRouter.HandleFSActivity(
		keybase1.FSNotification{
			TopLevelFolder:   arg.TopLevelFolder,
			Filename:         arg.Filename,
			NotificationType: keybase1.FSNotificationType_REKEYING,
		})
	return nil
}
