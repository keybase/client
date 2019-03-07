// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package pvl

import (
	"fmt"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type metaContext struct {
	libkb.MetaContext
	stubDNS *stubDNSEngine
}

func newMetaContext(m libkb.MetaContext, d *stubDNSEngine) metaContext {
	return metaContext{m, d}
}

func (m metaContext) getStubDNS() *stubDNSEngine {
	return m.stubDNS
}

func debugWithState(m metaContext, state scriptState, format string, arg ...interface{}) {
	s := fmt.Sprintf(format, arg...)
	m.Debug("PVL @(service:%v script:%v pc:%v) %v",
		debugServiceToString(state.Service), state.WhichScript, state.PC, s)
}

func debugWithStateError(m metaContext, state scriptState, err libkb.ProofError) {
	m.Debug("PVL @(service:%v script:%v pc:%v) Error code=%v: %v",
		debugServiceToString(state.Service), state.WhichScript, state.PC, err.GetProofStatus(), err.GetDesc())
}

func debugWithPosition(m metaContext, service keybase1.ProofType, whichscript int, pc int, format string, arg ...interface{}) {
	s := fmt.Sprintf(format, arg...)
	m.Debug("PVL @(service:%v script:%v pc:%v) %v",
		debugServiceToString(service), whichscript, pc, s)
}

func debug(m metaContext, format string, arg ...interface{}) {
	s := fmt.Sprintf(format, arg...)
	m.Debug("PVL %v", s)
}

// debugServiceToString returns the name of a service or number string if it is invalid.
func debugServiceToString(service keybase1.ProofType) string {
	s, err := serviceToString(service)
	if err != nil {
		return string(service)
	}
	return s
}
