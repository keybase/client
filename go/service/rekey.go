// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type RekeyHandler struct {
	*BaseHandler
	gregor *gregorHandler
	libkb.Contextified
}

func NewRekeyHandler(xp rpc.Transporter, g *libkb.GlobalContext, gregor *gregorHandler) *RekeyHandler {
	return &RekeyHandler{
		BaseHandler:  NewBaseHandler(xp),
		gregor:       gregor,
		Contextified: libkb.NewContextified(g),
	}
}

func (h *RekeyHandler) ShowPendingRekeyStatus(ctx context.Context, sessionID int) error {
	return nil
}

func (h *RekeyHandler) ShowRekeyStatus(ctx context.Context, arg keybase1.ShowRekeyStatusArg) error {
	return nil
}

func (h *RekeyHandler) GetProblemSet(ctx context.Context, sessionID int) (keybase1.ProblemSet, error) {
	return keybase1.ProblemSet{}, nil
}

func (h *RekeyHandler) RekeyStatusFinish(ctx context.Context, sessionID int) (keybase1.Outcome, error) {
	return h.gregor.RekeyStatusFinish(ctx, sessionID)
}
