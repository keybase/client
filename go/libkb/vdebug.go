// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"github.com/keybase/client/go/logger"
	"strings"
)

// VDebugLog is a "Verbose" debug logger; enable it if you really
// want spam and/or minutiae
type VDebugLog struct {
	log logger.Logger
	lev VDebugLevel
	tag VDebugTag
}

type VDebugLevel int

func NewVDebugLog(l logger.Logger) *VDebugLog {
	return &VDebugLog{log: l}
}

const (
	VLog0 VDebugLevel = 0
	VLog1 VDebugLevel = 1
	VLog2 VDebugLevel = 2
	VLog3 VDebugLevel = 3
)

type VDebugTag uint64

const (
	VTagNone     VDebugTag = 0x0
	VTagSigChain VDebugTag = 0x1
	VTagLoadUser VDebugTag = 0x2
	VTagConfig   VDebugTag = 0x4
	VTagLevelDB  VDebugTag = 0x8
	VTagAll      VDebugTag = 0xffffffff
)

func (v *VDebugLog) Log(lev VDebugLevel, tag VDebugTag, fs string, args ...interface{}) {
	fmt.Printf("YO {%d.%d} v {%d.%d}\n", lev, tag, v.lev, v.tag)
	if lev <= v.lev && (tag&v.tag) != 0 {
		v.log.Debug(fs, args...)
	}
}

func (v *VDebugLog) Configure(s string) {
	if len(s) == 0 {
		return
	}
	v.log.Debug("Setting Vdebug to %q", s)
	parts := strings.Split(s, ",")
	v.lev = VLog0
	v.tag = VTagNone
	for _, s := range parts {
		switch s {
		case "vlog0":
			v.lev = VLog0
		case "vlog1":
			v.lev = VLog1
		case "vlog2":
			v.lev = VLog2
		case "vlog3":
			v.lev = VLog3
		case "sigchain":
			v.tag |= VTagSigChain
		case "loaduser":
			v.tag |= VTagLoadUser
		case "leveldb":
			v.tag |= VTagLevelDB
		case "config":
			v.tag |= VTagConfig
		default:
			v.log.Warning("Ignoring Vdebug log directive: %q", s)
		}
	}
}
