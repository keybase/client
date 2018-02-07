// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"io"
	"os"
	"runtime/trace"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type PprofHandler struct {
	libkb.Contextified
	*BaseHandler
}

func NewPprofHandler(xp rpc.Transporter, g *libkb.GlobalContext) *PprofHandler {
	return &PprofHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (c *PprofHandler) Trace(_ context.Context, arg keybase1.TraceArg) (err error) {
	sessionID := arg.SessionID
	traceFile := arg.TraceFile
	traceDurationSeconds := arg.TraceDurationSeconds

	ctx := engine.Context{
		LogUI:     c.getLogUI(sessionID),
		SessionID: sessionID,
	}

	close := func(c io.Closer) {
		err := c.Close()
		if err != nil {
			ctx.LogUI.Warning("Failed to close %s: %s", traceFile, err)
		}
	}

	defer func() {
		if err != nil {
			ctx.LogUI.Warning("Failed to trace to %s for %d second(s): %s", traceFile, traceDurationSeconds, err)
		}
	}()

	f, err := os.Create(traceFile)
	if err != nil {
		return err
	}

	err = trace.Start(f)
	if err != nil {
		close(f)
		return err
	}

	c.G().Log.Info("Tracing to %s for %d seconds", traceFile, traceDurationSeconds)

	go func() {
		time.Sleep(time.Duration(float64(traceDurationSeconds) * float64(time.Second)))
		trace.Stop()
		close(f)
		c.G().Log.Info("Tracing to %s done", traceFile)
	}()

	return nil
}
