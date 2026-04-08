// Copyright 2026 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
//go:build !windows
// +build !windows

package libfsdriver

import "github.com/keybase/client/go/kbfs/libkbfs"

// StartOptions are options for starting the macOS/Linux KBFS filesystem driver.
type StartOptions struct {
	KbfsParams        libkbfs.InitParams
	PlatformParams    PlatformParams
	RuntimeDir        string
	Label             string
	ForceMount        bool
	MountErrorIsFatal bool
	SkipMount         bool
	MountPoint        string
}
