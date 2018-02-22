// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
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

func durationSecToDuration(s keybase1.DurationSec) time.Duration {
	return time.Duration(float64(s) * float64(time.Second))
}

func (c *PprofHandler) trace(ctx engine.Context, traceFile string, traceDurationSeconds keybase1.DurationSec) (err error) {
	if !filepath.IsAbs(traceFile) {
		return fmt.Errorf("%q is not an absolute path", traceFile)
	}

	close := func(c io.Closer) {
		err := c.Close()
		if err != nil {
			ctx.LogUI.Warning("Failed to close %s: %s", traceFile, err)
		}
	}

	defer func() {
		if err != nil {
			ctx.LogUI.Warning("Failed to trace to %s for %.2f second(s): %s", traceFile, traceDurationSeconds, err)
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

	c.G().Log.Info("Tracing to %s for %.2f second(s)", traceFile, traceDurationSeconds)

	go func() {
		time.Sleep(durationSecToDuration(traceDurationSeconds))
		trace.Stop()
		close(f)
		c.G().Log.Info("Tracing to %s done", traceFile)
	}()

	return nil
}

func (c *PprofHandler) Trace(_ context.Context, arg keybase1.TraceArg) (err error) {
	ctx := engine.Context{
		LogUI:     c.getLogUI(arg.SessionID),
		SessionID: arg.SessionID,
	}
	return c.trace(ctx, arg.TraceFile, arg.TraceDurationSeconds)
}

func (c *PprofHandler) LogTrace(_ context.Context, arg keybase1.LogTraceArg) (err error) {
	ctx := engine.Context{
		LogUI:     c.getLogUI(arg.SessionID),
		SessionID: arg.SessionID,
	}

	// Assume this directory already exists, i.e. we've already
	// started logging.
	var logDir string
	if len(arg.LogDirForMobile) > 0 {
		logDir = arg.LogDirForMobile
	} else {
		logDir = c.G().Env.GetLogDir()
	}

	traceFiles, err := libkb.GetSortedTraceFiles(logDir)
	if err != nil {
		ctx.LogUI.Warning("Error getting trace files in %q: %s", traceDir, err)
	} else if len(matches)+1 > libkb.MaxTraceFileCount {
		// Remove old trace files.
		toRemove := matches[:len(matches)+1-maxTraceFileCount]
		for _, path := range toRemove {
			c.G().Log.Info("Removing old trace file %q", path)
			err := os.Remove(path)
			if err != nil {
				ctx.LogUI.Warning("Error on os.Remove(%q): %s", path, err)
			}
		}
	}

	traceFile := libkb.MakeTraceFilename(logDir, time.Now(), durationSecToDuration(arg.TraceDurationSeconds))
	return c.trace(ctx, traceFile, arg.TraceDurationSeconds)
}
