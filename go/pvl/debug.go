// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package pvl

import (
	"fmt"

	libkb "github.com/keybase/client/go/libkb"
	logger "github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type proofContextExt interface {
	libkb.ProofContext
	GetLogPvl() logger.Logger
	getStubDNS() *stubDNSEngine
}

type proofContextExtImpl struct {
	libkb.ProofContext
	pvlLogger logger.Logger
	stubDNS   *stubDNSEngine
}

func newProofContextExt(ctx libkb.ProofContext, stubDNS *stubDNSEngine) proofContextExt {
	pvlLogger := ctx.GetLog().CloneWithAddedDepth(1)
	return &proofContextExtImpl{
		ctx,
		pvlLogger,
		stubDNS,
	}
}

func (ctx *proofContextExtImpl) GetLogPvl() logger.Logger {
	return ctx.pvlLogger
}

func (ctx *proofContextExtImpl) getStubDNS() *stubDNSEngine {
	return ctx.stubDNS
}

func debugWithState(g proofContextExt, state scriptState, format string, arg ...interface{}) {
	s := fmt.Sprintf(format, arg...)
	g.GetLogPvl().CDebugf(g.GetNetContext(), "PVL @(service:%v script:%v pc:%v) %v",
		debugServiceToString(state.Service), state.WhichScript, state.PC, s)
}

func debugWithStateError(g proofContextExt, state scriptState, err libkb.ProofError) {
	g.GetLogPvl().CDebugf(g.GetNetContext(), "PVL @(service:%v script:%v pc:%v) Error code=%v: %v",
		debugServiceToString(state.Service), state.WhichScript, state.PC, err.GetProofStatus(), err.GetDesc())
}

func debugWithPosition(g proofContextExt, service keybase1.ProofType, whichscript int, pc int, format string, arg ...interface{}) {
	s := fmt.Sprintf(format, arg...)
	g.GetLogPvl().CDebugf(g.GetNetContext(), "PVL @(service:%v script:%v pc:%v) %v",
		debugServiceToString(service), whichscript, pc, s)
}

func debug(g proofContextExt, format string, arg ...interface{}) {
	s := fmt.Sprintf(format, arg...)
	g.GetLogPvl().CDebugf(g.GetNetContext(), "PVL %v", s)
}

// debugServiceToString returns the name of a service or number string if it is invalid.
func debugServiceToString(service keybase1.ProofType) string {
	s, err := serviceToString(service)
	if err != nil {
		return string(service)
	}
	return s
}
