// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"io"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

type KBCMFHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewKBCMFHandler(xp rpc.Transporter, g *libkb.GlobalContext) *KBCMFHandler {
	return &KBCMFHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *KBCMFHandler) KbcmfEncrypt(_ context.Context, arg keybase1.KbcmfEncryptArg) error {
	cli := h.getStreamUICli()
	src := libkb.NewRemoteStreamBuffered(arg.Source, cli, arg.SessionID)
	snk := libkb.NewRemoteStreamBuffered(arg.Sink, cli, arg.SessionID)

	_, err := io.Copy(snk, src)
	if err != nil {
		return err
	}

	err = snk.Close()
	if err != nil {
		return err
	}

	return nil
}
