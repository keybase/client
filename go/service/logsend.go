// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"errors"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type LogsendHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewLogsendHandler(xp rpc.Transporter, g *libkb.GlobalContext) *LogsendHandler {
	return &LogsendHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *LogsendHandler) PrepareLogsend(ctx context.Context) error {
	connMgr := h.G().ConnectionManager
	if connMgr == nil {
		return errors.New("no connection manager available")
	}
	xp := connMgr.LookupByClientType(keybase1.ClientType_GUI_MAIN)
	if xp == nil {
		return errors.New("GUI main process wasn't found")
	}

	cli := keybase1.LogsendClient{Cli: rpc.NewClient(xp, libkb.NewContextifiedErrorUnwrapper(h.G()), nil)}
	var cancel func()
	ctx, cancel = context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	return cli.PrepareLogsend(ctx)
}
