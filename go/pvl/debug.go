// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package pvl

import (
	"fmt"

	libkb "github.com/keybase/client/go/libkb"
	logger "github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type ProofContextExt interface {
	libkb.ProofContext
	GetLogPvl() logger.Logger
}

type ProofContextExtImpl struct {
	libkb.ProofContext
	pvlLogger logger.Logger
}

func NewProofContextExt(ctx libkb.ProofContext) ProofContextExt {
	pvlLogger := ctx.GetLog().CloneWithAddedDepth(1)
	return &ProofContextExtImpl{
		ctx,
		pvlLogger,
	}
}

func (ctx *ProofContextExtImpl) GetLogPvl() logger.Logger {
	return ctx.pvlLogger
}

func debugWithState(g ProofContextExt, state ScriptState, format string, arg ...interface{}) {
	s := fmt.Sprintf(format, arg...)
	g.GetLogPvl().Debug("PVL @(service:%v script:%v pc:%v) %v",
		debugServiceToString(state.Service), state.WhichScript, state.PC, s)
}

func debugWithStateError(g ProofContextExt, state ScriptState, err libkb.ProofError) {
	g.GetLogPvl().Debug("PVL @(service:%v script:%v pc:%v) Error code=%v: %v",
		debugServiceToString(state.Service), state.WhichScript, state.PC, err.GetProofStatus(), err.GetDesc())
}

func debugWithPosition(g ProofContextExt, service keybase1.ProofType, whichscript int, pc int, format string, arg ...interface{}) {
	s := fmt.Sprintf(format, arg...)
	g.GetLogPvl().Debug("PVL @(service:%v script:%v pc:%v) %v",
		debugServiceToString(service), whichscript, pc, s)
}

func debug(g ProofContextExt, format string, arg ...interface{}) {
	s := fmt.Sprintf(format, arg...)
	g.GetLogPvl().Debug("PVL %v", s)
}

// debugServiceToString returns the name of a service or number string if it is invalid.
func debugServiceToString(service keybase1.ProofType) string {
	s, err := serviceToString(service)
	if err != nil {
		return string(service)
	}
	return s
}
