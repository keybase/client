// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

// LogHandler is the RPC handler for the log interface.
type LogHandler struct {
	*BaseHandler
	logq *logQueue
	libkb.Contextified
}

// NewLogHandler creates a LogHandler for the xp transport.
func NewLogHandler(xp rpc.Transporter, logq *logQueue, g *libkb.GlobalContext) *LogHandler {
	return &LogHandler{
		BaseHandler:  NewBaseHandler(xp),
		logq:         logq,
		Contextified: libkb.NewContextified(g),
	}
}

func (h *LogHandler) RegisterLogger(_ context.Context, arg keybase1.RegisterLoggerArg) error {
	h.G().Log.Debug("RegisterLogger: %+v", arg)
	ui := &LogUI{sessionID: arg.SessionID, cli: h.getLogUICli()}
	return h.logq.Setup(arg.Name, arg.Level, ui)
}
