// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/profiling/pprof"
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

func (c *PprofHandler) ProcessorProfile(_ context.Context, arg keybase1.ProcessorProfileArg) (err error) {
	return pprof.DoTimedPprofProfile(c.G().Log, pprof.CpuPprofProfiler{}, arg.ProfileFile,
		arg.ProfileDurationSeconds)
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
	return pprof.DoTimedPprofProfileInDir(c.G().Log, pprof.CpuPprofProfiler{},
		c.logDir(arg.LogDirForMobile), arg.ProfileDurationSeconds)
}

func (c *PprofHandler) Trace(_ context.Context, arg keybase1.TraceArg) (err error) {
	return pprof.DoTimedPprofProfile(c.G().Log, pprof.TracePprofProfiler{}, arg.TraceFile,
		arg.TraceDurationSeconds)
}

func (c *PprofHandler) LogTrace(_ context.Context, arg keybase1.LogTraceArg) (err error) {
	return pprof.DoTimedPprofProfileInDir(c.G().Log, pprof.TracePprofProfiler{},
		c.logDir(arg.LogDirForMobile), arg.TraceDurationSeconds)
}
