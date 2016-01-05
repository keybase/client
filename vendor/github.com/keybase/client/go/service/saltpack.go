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

type SaltPackHandler struct {
	*BaseHandler
	libkb.Contextified
}

type RemoteSaltPackUI struct {
	sessionID int
	cli       keybase1.SaltPackUiClient
}

func NewRemoteSaltPackUI(sessionID int, c *rpc.Client) *RemoteSaltPackUI {
	return &RemoteSaltPackUI{
		sessionID: sessionID,
		cli:       keybase1.SaltPackUiClient{Cli: c},
	}
}

func (r *RemoteSaltPackUI) SaltPackPromptForDecrypt(ctx context.Context, arg keybase1.SaltPackPromptForDecryptArg) (err error) {
	arg.SessionID = r.sessionID
	return r.cli.SaltPackPromptForDecrypt(ctx, arg)
}

func NewSaltPackHandler(xp rpc.Transporter, g *libkb.GlobalContext) *SaltPackHandler {
	return &SaltPackHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *SaltPackHandler) SaltPackDecrypt(_ context.Context, arg keybase1.SaltPackDecryptArg) (info keybase1.SaltPackEncryptedMessageInfo, err error) {
	cli := h.getStreamUICli()
	src := libkb.NewRemoteStreamBuffered(arg.Source, cli, arg.SessionID)
	snk := libkb.NewRemoteStreamBuffered(arg.Sink, cli, arg.SessionID)
	earg := &engine.SaltPackDecryptArg{
		Sink:   snk,
		Source: src,
		Opts:   arg.Opts,
	}

	ctx := &engine.Context{
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID, h.G()),
		SecretUI:   h.getSecretUI(arg.SessionID),
		SaltPackUI: h.getSaltPackUI(arg.SessionID),
	}
	eng := engine.NewSaltPackDecrypt(earg, h.G())
	err = engine.RunEngine(eng, ctx)
	info = eng.MessageInfo()
	return info, err
}

func (h *SaltPackHandler) SaltPackEncrypt(_ context.Context, arg keybase1.SaltPackEncryptArg) error {
	cli := h.getStreamUICli()
	src := libkb.NewRemoteStreamBuffered(arg.Source, cli, arg.SessionID)
	snk := libkb.NewRemoteStreamBuffered(arg.Sink, cli, arg.SessionID)
	earg := &engine.SaltPackEncryptArg{
		Opts:   arg.Opts,
		Sink:   snk,
		Source: src,
	}

	ctx := &engine.Context{
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID, h.G()),
		SecretUI:   h.getSecretUI(arg.SessionID),
	}
	eng := engine.NewSaltPackEncrypt(earg, h.G())
	return engine.RunEngine(eng, ctx)
}
