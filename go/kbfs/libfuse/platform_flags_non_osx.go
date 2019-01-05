// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build !darwin,!windows

package libfuse

import "flag"

// PlatformParams contains all platform-specific parameters to be
// passed to New{Default,Force}Mounter.
type PlatformParams struct{}

func (p PlatformParams) shouldAppendPlatformRootDirs() bool {
	return false
}

// GetPlatformUsageString returns a string to be included in a usage
// string corresponding to the flags added by AddPlatformFlags.
func GetPlatformUsageString() string {
	return ""
}

// AddPlatformFlags adds platform-specific flags to the given FlagSet
// and returns a PlatformParams object that will be filled in when the
// given FlagSet is parsed.
func AddPlatformFlags(flags *flag.FlagSet) *PlatformParams {
	var params PlatformParams
	return &params
}
