// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/logger"
	"golang.org/x/net/context"
)

// VDebugLog is a "Verbose" debug logger; enable it if you really
// want spam and/or minutiae
type VDebugLog struct {
	log              logger.Logger
	lev              VDebugLevel
	dumpSiteLoadUser bool
	dumpPayload      bool
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
)

func (v *VDebugLog) Log(lev VDebugLevel, fs string, args ...interface{}) {
	if lev <= v.lev {
		prfx := fmt.Sprintf("{VDL:%d} ", int(lev))
		fs = prfx + fs
		v.log.CloneWithAddedDepth(1).Debug(fs, args...)
	}
}

func (v *VDebugLog) CLogf(ctx context.Context, lev VDebugLevel, fs string, args ...interface{}) {
	if lev <= v.lev {
		prfx := fmt.Sprintf("{VDL:%d} ", int(lev))
		fs = prfx + fs
		v.log.CloneWithAddedDepth(1).CDebugf(ctx, fs, args...)
	}
}

func (v *VDebugLog) CLogfWithAddedDepth(ctx context.Context, lev VDebugLevel, d int, fs string, args ...interface{}) {
	if lev <= v.lev {
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
	v.lev = VLog0
	if len(s) == 0 {
		return
	}
	v.log.Debug("Setting Vdebug to %q", s)
	parts := strings.Split(s, ",")
	for _, s := range parts {
		switch s {
		case "mobile":
			v.lev = VLogNone
		case "vlog0":
			v.lev = VLog0
		case "vlog1":
			v.lev = VLog1
		case "vlog2":
			v.lev = VLog2
		case "vlog3":
			v.lev = VLog3
		case "dump-site-load-user":
			v.dumpSiteLoadUser = true
		case "dump-payload":
			v.dumpPayload = true
		default:
			v.log.Warning("Ignoring Vdebug log directive: %q", s)
		}
	}
}
