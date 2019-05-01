// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build !windows

package libfuse

import (
	"fmt"
	"regexp"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
)

var statfsOrAccessRegexp = regexp.MustCompile(`^(<-|->).* (Statfs|Access)`)

// MakeFuseDebugFn returns a function that logs its argument to the
// given log, suitable to assign to fuse.Debug.
func MakeFuseDebugFn(
	log logger.Logger, superVerbose bool) func(msg interface{}) {
	return func(msg interface{}) {
		str := fmt.Sprintf("%s", msg)
		// If superVerbose is not set, filter out Statfs and
		// Access messages, since they're spammy on OS X.
		//
		// Ideally, bazil would let us filter this better, and
		// also pass in the ctx.
		if !superVerbose && statfsOrAccessRegexp.MatchString(str) {
			return
		}
		log.Debug("%s", str)
	}
}

// MakeFuseVDebugFn returns a function that logs its argument to the
// given vlog at level 1, suitable to assign to fuse.Debug.
func MakeFuseVDebugFn(
	vlog *libkb.VDebugLog, superVerbose bool) func(msg interface{}) {
	return func(msg interface{}) {
		str := fmt.Sprintf("%s", msg)
		// If superVerbose is not set, filter out Statfs and
		// Access messages, since they're spammy on OS X.
		//
		// Ideally, bazil would let us filter this better, and
		// also pass in the ctx.
		if !superVerbose && statfsOrAccessRegexp.MatchString(str) {
			return
		}
		vlog.Log(libkb.VLog1, "%s", str)
	}
}
