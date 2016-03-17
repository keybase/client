// +build darwin

package libfuse

import "flag"

// PlatformParams contains all platform-specific parameters to be
// passed to New{Default,Force}Mounter.
type PlatformParams struct {
	UseSystemFuse bool
}

// GetPlatformUsageString returns a string to be included in a usage
// string corresponding to the flags added by AddPlatformFlags.
func GetPlatformUsageString() string {
	return "[--use-system-fuse] "
}

// AddPlatformFlags adds platform-specific flags to the given FlagSet
// and returns a PlatformParams object that will be filled in when the
// given FlagSet is parsed.
func AddPlatformFlags(flags *flag.FlagSet) *PlatformParams {
	var params PlatformParams
	flags.BoolVar(&params.UseSystemFuse, "use-system-fuse", false,
		"Use the system OSXFUSE instead of keybase's OSXFUSE")
	return &params
}
