// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

// LogHandler is the RPC handler for the log interface.
type LogHandler struct {
	*BaseHandler
	logReg *logRegister
	libkb.Contextified
}

// NewLogHandler creates a LogHandler for the xp transport.
func NewLogHandler(xp rpc.Transporter, logReg *logRegister, g *libkb.GlobalContext) *LogHandler {
	return &LogHandler{
		BaseHandler:  NewBaseHandler(xp),
		logReg:       logReg,
		Contextified: libkb.NewContextified(g),
	}
}

func (h *LogHandler) RegisterLogger(_ context.Context, arg keybase1.RegisterLoggerArg) (err error) {
	h.G().Log.Debug("LogHandler::RegisterLogger: %+v", arg)
	defer h.G().Trace("LogHandler::RegisterLogger", func() error { return err })()

	if h.logReg == nil {
		// if not a daemon, h.logReg will be nil
		h.G().Log.Debug("- logRegister is nil, ignoring RegisterLogger request")
		return nil
	}

	ui := &LogUI{sessionID: arg.SessionID, cli: h.getLogUICli()}
	err = h.logReg.RegisterLogger(arg, ui)
	return err
}
