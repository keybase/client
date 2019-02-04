// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type KBFSMountHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewKBFSMountHandler(xp rpc.Transporter, g *libkb.GlobalContext) *KBFSMountHandler {
	return &KBFSMountHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *KBFSMountHandler) GetCurrentMountDir(ctx context.Context) (res string, err error) {
	return h.G().Env.GetMountDir()
}

func (h *KBFSMountHandler) GetAllAvailableMountDirs(ctx context.Context) (res []string, err error) {
	return getMountDirs()
}

func (h *KBFSMountHandler) SetCurrentMountDir(_ context.Context, drive string) (err error) {
	oldMount, _ := h.G().Env.GetMountDir()
	w := h.G().Env.GetConfigWriter()
	err = w.SetStringAtPath("mountdir", drive)
	if err != nil {
		return err
	}
	h.G().ConfigReload()
	libkb.ChangeMountIcon(oldMount, drive)
	return nil
}
