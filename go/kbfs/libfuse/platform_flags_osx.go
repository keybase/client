// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.//
//
// +build darwin

package libfuse

import "flag"

// PlatformParams contains all platform-specific parameters to be
// passed to New{Default,Force}Mounter.
type PlatformParams struct {
	UseSystemFuse bool
	UseLocal      bool
}

func (p PlatformParams) shouldAppendPlatformRootDirs() bool {
	return p.UseLocal
}

// GetPlatformUsageString returns a string to be included in a usage
// string corresponding to the flags added by AddPlatformFlags.
func GetPlatformUsageString() string {
	return "[--use-system-fuse] [--local-experimental]\n    "
}

// AddPlatformFlags adds platform-specific flags to the given FlagSet
// and returns a PlatformParams object that will be filled in when the
// given FlagSet is parsed.
func AddPlatformFlags(flags *flag.FlagSet) *PlatformParams {
	var params PlatformParams
	flags.BoolVar(&params.UseSystemFuse, "use-system-fuse", false,
		"Use the system OSXFUSE instead of keybase's OSXFUSE")
	flags.BoolVar(&params.UseLocal, "local-experimental", false,
		"Use 'local' mount option and enable other hacky stuff for testing macOS "+
			"apps. The \"hacky stuff\" includes a Trash implementation that only "+
			"works for the user's own private TLF, so if you enable this please "+
			"only work under your own private TLF.")
	return &params
}
