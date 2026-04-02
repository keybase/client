// Copyright 2026 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
//go:build darwin
// +build darwin

package libfsdriver

import "flag"

// PlatformParams contains all platform-specific parameters.
type PlatformParams struct {
	// Keep the existing flag for compatibility with tooling/scripts; it is ignored
	// by the FSKit backend.
	UseLocal bool
}

// GetPlatformUsageString returns a string to be included in usage output.
func GetPlatformUsageString() string {
	return "[--local-experimental]\n    "
}

// AddPlatformFlags adds platform-specific flags to the given FlagSet.
func AddPlatformFlags(flags *flag.FlagSet) *PlatformParams {
	var params PlatformParams
	flags.BoolVar(&params.UseLocal, "local-experimental", false,
		"Legacy local mode flag (ignored by the macOS FSKit backend)")
	return &params
}
