// Copyright 2026 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
//go:build !darwin && !windows
// +build !darwin,!windows

package libfsdriver

import (
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libfuse"
	"github.com/keybase/client/go/kbfs/libkbfs"
)

// Start launches the non-macOS KBFS FUSE stack.
func Start(options StartOptions, kbCtx libkbfs.Context) *libfs.Error {
	return libfuse.Start(libfuse.StartOptions{
		KbfsParams:        options.KbfsParams,
		PlatformParams:    libfuse.PlatformParams{UseSystemFuse: options.PlatformParams.UseSystemFuse, UseLocal: options.PlatformParams.UseLocal},
		RuntimeDir:        options.RuntimeDir,
		Label:             options.Label,
		ForceMount:        options.ForceMount,
		MountErrorIsFatal: options.MountErrorIsFatal,
		SkipMount:         options.SkipMount,
		MountPoint:        options.MountPoint,
	}, kbCtx)
}
