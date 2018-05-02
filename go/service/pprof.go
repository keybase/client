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

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
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

	MaxFileCount() int
	MakeFilename(dir string, start time.Time, duration time.Duration) string
	GetSortedFiles(dir string) ([]string, error)

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

func doTimedProfileInDir(log libkb.LogUI, delayedLog logger.Logger,
	profiler timedProfiler, dir string,
	durationSeconds keybase1.DurationSec) (err error) {
	name := profiler.Name()
	maxFileCount := profiler.MaxFileCount()
	files, err := profiler.GetSortedFiles(dir)
	if err != nil {
		log.Warning("Error getting %s profile files in %q: %s",
			name, dir, err)
	} else if len(files)+1 > maxFileCount {
		// Remove old trace files.
		toRemove := files[:len(files)+1-maxFileCount]
		for _, path := range toRemove {
			log.Info("Removing old %s profile file %q", name, path)
			err := os.Remove(path)
			if err != nil {
				log.Warning("Error on os.Remove(%q): %s", path, err)
			}
		}
	}

	outputFile := profiler.MakeFilename(dir, time.Now(), durationSecToDuration(durationSeconds))
	return doTimedProfile(log, delayedLog, profiler, outputFile, durationSeconds)
}

type cpuProfiler struct{}

func (cpuProfiler) Name() string { return "CPU" }

func (cpuProfiler) MaxFileCount() int {
	return libkb.MaxCPUProfileFileCount
}

func (cpuProfiler) MakeFilename(dir string, start time.Time, duration time.Duration) string {
	return libkb.MakeCPUProfileFilename(dir, start, duration)
}

func (cpuProfiler) GetSortedFiles(dir string) ([]string, error) {
	return libkb.GetSortedCPUProfileFiles(dir)
}

func (cpuProfiler) Start(w io.Writer) error {
	return pprof.StartCPUProfile(w)
}

func (cpuProfiler) Stop() {
	pprof.StopCPUProfile()
}

func (c *PprofHandler) ProcessorProfile(_ context.Context, arg keybase1.ProcessorProfileArg) (err error) {
	logui := c.getLogUI(arg.SessionID)
	return doTimedProfile(logui, c.G().Log, cpuProfiler{}, arg.ProfileFile, arg.ProfileDurationSeconds)
}

func (c *PprofHandler) logDir(logDirForMobile string) string {
	// Assume the returned directory already exists, i.e. we've
	// already started logging.
	if len(logDirForMobile) > 0 {
		return logDirForMobile
	}
	return c.G().Env.GetLogDir()
}

func (c *PprofHandler) LogProcessorProfile(_ context.Context, arg keybase1.LogProcessorProfileArg) (err error) {
	logui := c.getLogUI(arg.SessionID)
	return doTimedProfileInDir(logui, c.G().Log, cpuProfiler{}, c.logDir(arg.LogDirForMobile), arg.ProfileDurationSeconds)
}

type traceProfiler struct{}

func (traceProfiler) Name() string { return "trace" }

func (traceProfiler) MaxFileCount() int { return libkb.MaxTraceFileCount }

func (traceProfiler) MakeFilename(dir string, start time.Time, duration time.Duration) string {
	return libkb.MakeTraceFilename(dir, start, duration)
}

func (traceProfiler) GetSortedFiles(dir string) ([]string, error) {
	return libkb.GetSortedTraceFiles(dir)
}

func (traceProfiler) Start(w io.Writer) error {
	return trace.Start(w)
}

func (traceProfiler) Stop() {
	trace.Stop()
}

func (c *PprofHandler) Trace(_ context.Context, arg keybase1.TraceArg) (err error) {
	logui := c.getLogUI(arg.SessionID)
	return doTimedProfile(logui, c.G().Log, traceProfiler{}, arg.TraceFile, arg.TraceDurationSeconds)
}

func (c *PprofHandler) LogTrace(_ context.Context, arg keybase1.LogTraceArg) (err error) {
	logui := c.getLogUI(arg.SessionID)
	return doTimedProfileInDir(logui, c.G().Log, traceProfiler{}, c.logDir(arg.LogDirForMobile), arg.TraceDurationSeconds)
}
