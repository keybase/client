// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"github.com/keybase/go-updater"
	"golang.org/x/net/context"
)

type UpdateHandler struct {
	*BaseHandler
	libkb.Contextified
	updateChecker *updater.UpdateChecker
}

func NewUpdateHandler(xp rpc.Transporter, g *libkb.GlobalContext, updateChecker *updater.UpdateChecker) *UpdateHandler {
	return &UpdateHandler{
		BaseHandler:   NewBaseHandler(xp),
		Contextified:  libkb.NewContextified(g),
		updateChecker: updateChecker,
	}
}

func (h *UpdateHandler) Update(_ context.Context, options keybase1.UpdateOptions) (result keybase1.UpdateResult, err error) {
	ctx := engine.Context{
		UpdateUI: h.getUpdateUI(),
	}
	eng := engine.NewUpdateEngine(h.G(), options)
	err = engine.RunEngine(eng, &ctx)
	if err != nil {
		return
	}
	result = keybase1.UpdateResult{Update: eng.Result}
	return
}

func (h *UpdateHandler) UpdateCheck(_ context.Context, force bool) error {
	if h.updateChecker == nil {
		return fmt.Errorf("No updater available")
	}
	_, err := h.updateChecker.Check(force, true)
	return err
}
