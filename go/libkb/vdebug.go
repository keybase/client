// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"strings"
	"sync"

	"github.com/keybase/client/go/logger"
	"golang.org/x/net/context"
)

// VDebugLog is a "Verbose" debug logger; enable it if you really
// want spam and/or minutiae
type VDebugLog struct {
	log              logger.Logger
	dumpSiteLoadUser bool
	dumpPayload      bool

	lock sync.RWMutex
	lev  VDebugLevel
}

type VDebugLevel int

func NewVDebugLog(l logger.Logger) *VDebugLog {
	return &VDebugLog{log: l}
}

const (
	VLogNone VDebugLevel = iota - 1
	VLog0
	VLog1
	VLog2
	VLog3

	VLogNoneString       = "mobile"
	VLog0String          = "vlog0"
	VLog1String          = "vlog1"
	VLog2String          = "vlog2"
	VLog3String          = "vlog3"
	VLogDumpSiteLoadUser = "dump-site-load-user"
	VLogDumpPayload      = "dump-payload"
)

func (v VDebugLevel) String() string {
	switch v {
	case VLogNone:
		return VLogNoneString
	case VLog0:
		return VLog0String
	case VLog1:
		return VLog1String
	case VLog2:
		return VLog2String
	case VLog3:
		return VLog3String
	default:
		return "unknown"
	}
}

func (v *VDebugLog) getLev() VDebugLevel {
	v.lock.RLock()
	defer v.lock.RUnlock()
	return v.lev
}

func (v *VDebugLog) Log(lev VDebugLevel, fs string, args ...interface{}) {
	if lev <= v.getLev() {
		prfx := fmt.Sprintf("{VDL:%d} ", int(lev))
		fs = prfx + fs
		v.log.CloneWithAddedDepth(1).Debug(fs, args...)
	}
}

func (v *VDebugLog) CLogf(ctx context.Context, lev VDebugLevel, fs string, args ...interface{}) {
	if lev <= v.getLev() {
		prfx := fmt.Sprintf("{VDL:%d} ", int(lev))
		fs = prfx + fs
		v.log.CloneWithAddedDepth(1).CDebugf(ctx, fs, args...)
	}
}

func (v *VDebugLog) CLogfWithAddedDepth(ctx context.Context, lev VDebugLevel, d int, fs string, args ...interface{}) {
	if lev <= v.getLev() {
		prfx := fmt.Sprintf("{VDL:%d} ", int(lev))
		fs = prfx + fs
		v.log.CloneWithAddedDepth(1+d).CDebugf(ctx, fs, args...)
	}
}

func (v *VDebugLog) DumpSiteLoadUser() bool {
	return v.dumpSiteLoadUser
}

func (v *VDebugLog) DumpPayload() bool {
	return v.dumpPayload
}

func (v *VDebugLog) Configure(s string) {
	v.lock.Lock()
	defer v.lock.Unlock()

	v.lev = VLog0
	if len(s) == 0 {
		return
	}
	v.log.Debug("Setting Vdebug to %q", s)
	parts := strings.Split(s, ",")
	for _, s := range parts {
		switch s {
		case VLogNoneString:
			v.lev = VLogNone
		case VLog0String:
			v.lev = VLog0
		case VLog1String:
			v.lev = VLog1
		case VLog2String:
			v.lev = VLog2
		case VLog3String:
			v.lev = VLog3
		case VLogDumpSiteLoadUser:
			v.dumpSiteLoadUser = true
		case VLogDumpPayload:
			v.dumpPayload = true
		default:
			v.log.Warning("Ignoring Vdebug log directive: %q", s)
		}
	}
}
