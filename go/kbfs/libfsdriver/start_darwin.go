// Copyright 2026 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
//go:build darwin
// +build darwin

package libfsdriver

import (
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libfskit"
	"github.com/keybase/client/go/kbfs/libkbfs"
)

// Start launches the macOS KBFS FSKit-backed driver stack.
func Start(options StartOptions, kbCtx libkbfs.Context) *libfs.Error {
	return libfskit.Start(libfskit.StartOptions{
		KbfsParams:        options.KbfsParams,
		PlatformParams:    libfskit.PlatformParams{UseLocal: options.PlatformParams.UseLocal},
		RuntimeDir:        options.RuntimeDir,
		Label:             options.Label,
		ForceMount:        options.ForceMount,
		MountErrorIsFatal: options.MountErrorIsFatal,
		SkipMount:         options.SkipMount,
		MountPoint:        options.MountPoint,
	}, kbCtx)
}
