// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"github.com/keybase/client/go/engine"
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

func (h *KBCMFHandler) KbcmfDecrypt(_ context.Context, arg keybase1.KbcmfDecryptArg) error {
	cli := h.getStreamUICli()
	src := libkb.NewRemoteStreamBuffered(arg.Source, cli, arg.SessionID)
	snk := libkb.NewRemoteStreamBuffered(arg.Sink, cli, arg.SessionID)
	earg := &engine.KBCMFDecryptArg{
		Sink:   snk,
		Source: src,
	}

	ctx := &engine.Context{
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID, h.G()),
		SecretUI:   h.getSecretUI(arg.SessionID),
	}
	eng := engine.NewKBCMFDecrypt(earg, h.G())
	return engine.RunEngine(eng, ctx)
}

func (h *KBCMFHandler) KbcmfEncrypt(_ context.Context, arg keybase1.KbcmfEncryptArg) error {
	cli := h.getStreamUICli()
	src := libkb.NewRemoteStreamBuffered(arg.Source, cli, arg.SessionID)
	snk := libkb.NewRemoteStreamBuffered(arg.Sink, cli, arg.SessionID)
	earg := &engine.KBCMFEncryptArg{
		Recips:       arg.Opts.Recipients,
		Sink:         snk,
		Source:       src,
		TrackOptions: arg.Opts.TrackOptions,
	}

	ctx := &engine.Context{
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID, h.G()),
		SecretUI:   h.getSecretUI(arg.SessionID),
	}
	eng := engine.NewKBCMFEncrypt(earg, h.G())
	return engine.RunEngine(eng, ctx)
}
