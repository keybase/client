// Copyright 2026 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
//go:build !darwin && !windows
// +build !darwin,!windows

package libfsdriver

import "flag"

// PlatformParams contains all platform-specific parameters.
type PlatformParams struct {
	UseSystemFuse bool
	UseLocal      bool
}

// GetPlatformUsageString returns a string to be included in usage output.
func GetPlatformUsageString() string {
	return "[--use-system-fuse] [--local-experimental]\n    "
}

// AddPlatformFlags adds platform-specific flags to the given FlagSet.
func AddPlatformFlags(flags *flag.FlagSet) *PlatformParams {
	var params PlatformParams
	flags.BoolVar(&params.UseSystemFuse, "use-system-fuse", false,
		"Use the system OSXFUSE instead of keybase's OSXFUSE")
	flags.BoolVar(&params.UseLocal, "local-experimental", false,
		"Use 'local' mount option and enable other hacky stuff for testing macOS apps")
	return &params
}
