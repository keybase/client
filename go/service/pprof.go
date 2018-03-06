// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime/pprof"
	"runtime/trace"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
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

type timedProfiler interface {
	Name() string
	Start(w io.Writer) error
	Stop()
}

// doTimedProfile asynchronously runs a profile with the given
// timedProfiler and associated parameters.
func doTimedProfile(log libkb.LogUI, delayedLog logger.Logger,
	profiler timedProfiler, outputFile string,
	durationSeconds keybase1.DurationSec) (err error) {
	if !filepath.IsAbs(outputFile) {
		return fmt.Errorf("%q is not an absolute path", outputFile)
	}

	close := func(c io.Closer) {
		err := c.Close()
		if err != nil {
			log.Warning("Failed to close %s: %s", outputFile, err)
		}
	}

	name := profiler.Name()

	defer func() {
		if err != nil {
			log.Warning("Failed to do %s profile to %s for %.2f second(s): %s", name, outputFile, durationSeconds, err)
		}
	}()

	f, err := os.Create(outputFile)
	if err != nil {
		return err
	}

	err = profiler.Start(f)
	if err != nil {
		close(f)
		return err
	}

	log.Info("Doing %s profile to %s for %.2f second(s)", name, outputFile, durationSeconds)

	go func() {
		time.Sleep(durationSecToDuration(durationSeconds))
		profiler.Stop()
		close(f)
		delayedLog.Info("%s profile to %s done", name, outputFile)
	}()

	return nil
}

type cpuProfiler struct{}

func (cpuProfiler) Name() string { return "CPU" }

func (cpuProfiler) Start(w io.Writer) error {
	return pprof.StartCPUProfile(w)
}

func (cpuProfiler) Stop() {
	pprof.StopCPUProfile()
}

func (c *PprofHandler) cpuProfile(ctx engine.Context, profileFile string, profileDurationSeconds keybase1.DurationSec) (err error) {
	return doTimedProfile(ctx.LogUI, c.G().Log, cpuProfiler{}, profileFile, profileDurationSeconds)
}

func (c *PprofHandler) ProcessorProfile(_ context.Context, arg keybase1.ProcessorProfileArg) (err error) {
	ctx := engine.Context{
		LogUI:     c.getLogUI(arg.SessionID),
		SessionID: arg.SessionID,
	}
	return c.cpuProfile(ctx, arg.ProfileFile, arg.ProfileDurationSeconds)
}

func (c *PprofHandler) LogProcessorProfile(_ context.Context, arg keybase1.LogProcessorProfileArg) (err error) {
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

	_ = ctx
	_ = logDir

	/*
		traceFiles, err := libkb.GetSortedCPUProfileFiles(logDir)
		if err != nil {
			ctx.LogUI.Warning("Error getting trace files in %q: %s", logDir, err)
		} else if len(traceFiles)+1 > libkb.MaxCPUProfileFileCount {
			// Remove old trace files.
			toRemove := traceFiles[:len(traceFiles)+1-libkb.MaxCPUProfileFileCount]
			for _, path := range toRemove {
				c.G().Log.Info("Removing old trace file %q", path)
				err := os.Remove(path)
				if err != nil {
					ctx.LogUI.Warning("Error on os.Remove(%q): %s", path, err)
				}
			}
		}

		traceFile := libkb.MakeCPUProfileFilename(logDir, time.Now(), durationSecToDuration(arg.CPUProfileDurationSeconds))
		return c.trace(ctx, traceFile, arg.CPUProfileDurationSeconds)
	*/
	panic("not implemented")
}

type traceProfiler struct{}

func (traceProfiler) Name() string { return "trace" }

func (traceProfiler) Start(w io.Writer) error {
	return trace.Start(w)
}

func (traceProfiler) Stop() {
	trace.Stop()
}

func (c *PprofHandler) trace(ctx engine.Context, traceFile string, traceDurationSeconds keybase1.DurationSec) (err error) {
	return doTimedProfile(ctx.LogUI, c.G().Log, traceProfiler{}, traceFile, traceDurationSeconds)
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
		ctx.LogUI.Warning("Error getting trace files in %q: %s", logDir, err)
	} else if len(traceFiles)+1 > libkb.MaxTraceFileCount {
		// Remove old trace files.
		toRemove := traceFiles[:len(traceFiles)+1-libkb.MaxTraceFileCount]
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
