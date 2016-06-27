package fuse

import (
	"errors"
	"strings"
)

func dummyOption(conf *mountConfig) error {
	return nil
}

// mountConfig holds the configuration for a mount operation.
// Use it by passing MountOption values to Mount.
type mountConfig struct {
	options          map[string]string
	maxReadahead     uint32
	initFlags        InitFlags
	osxfuseLocations []OSXFUSEPaths
}

func escapeComma(s string) string {
	s = strings.Replace(s, `\`, `\\`, -1)
	s = strings.Replace(s, `,`, `\,`, -1)
	return s
}

// getOptions makes a string of options suitable for passing to FUSE
// mount flag `-o`. Returns an empty string if no options were set.
// Any platform specific adjustments should happen before the call.
func (m *mountConfig) getOptions() string {
	var opts []string
	for k, v := range m.options {
		k = escapeComma(k)
		if v != "" {
			k += "=" + escapeComma(v)
		}
		opts = append(opts, k)
	}
	return strings.Join(opts, ",")
}

type mountOption func(*mountConfig) error

// MountOption is passed to Mount to change the behavior of the mount.
type MountOption mountOption

// FSName sets the file system name (also called source) that is
// visible in the list of mounted file systems.
//
// FreeBSD ignores this option.
func FSName(name string) MountOption {
	return func(conf *mountConfig) error {
		conf.options["fsname"] = name
		return nil
	}
}

// Subtype sets the subtype of the mount. The main type is always
// `fuse`. The type in a list of mounted file systems will look like
// `fuse.foo`.
//
// OS X ignores this option.
// FreeBSD ignores this option.
func Subtype(fstype string) MountOption {
	return func(conf *mountConfig) error {
		conf.options["subtype"] = fstype
		return nil
	}
}

// LocalVolume sets the volume to be local (instead of network),
// changing the behavior of Finder, Spotlight, and such.
//
// OS X only. Others ignore this option.
func LocalVolume() MountOption {
	return localVolume
}

// VolumeName sets the volume name shown in Finder.
//
// OS X only. Others ignore this option.
func VolumeName(name string) MountOption {
	return volumeName(name)
}

var ErrCannotCombineAllowOtherAndAllowRoot = errors.New("cannot combine AllowOther and AllowRoot")

// AllowOther allows other users to access the file system.
//
// Only one of AllowOther or AllowRoot can be used.
func AllowOther() MountOption {
	return func(conf *mountConfig) error {
		if _, ok := conf.options["allow_root"]; ok {
			return ErrCannotCombineAllowOtherAndAllowRoot
		}
		conf.options["allow_other"] = ""
		return nil
	}
}

// AllowRoot allows other users to access the file system.
//
// Only one of AllowOther or AllowRoot can be used.
//
// FreeBSD ignores this option.
func AllowRoot() MountOption {
	return func(conf *mountConfig) error {
		if _, ok := conf.options["allow_other"]; ok {
			return ErrCannotCombineAllowOtherAndAllowRoot
		}
		conf.options["allow_root"] = ""
		return nil
	}
}

// DefaultPermissions makes the kernel enforce access control based on
// the file mode (as in chmod).
//
// Without this option, the Node itself decides what is and is not
// allowed. This is normally ok because FUSE file systems cannot be
// accessed by other users without AllowOther/AllowRoot.
//
// FreeBSD ignores this option.
func DefaultPermissions() MountOption {
	return func(conf *mountConfig) error {
		conf.options["default_permissions"] = ""
		return nil
	}
}

// ReadOnly makes the mount read-only.
func ReadOnly() MountOption {
	return func(conf *mountConfig) error {
		conf.options["ro"] = ""
		return nil
	}
}

// MaxReadahead sets the number of bytes that can be prefetched for
// sequential reads. The kernel can enforce a maximum value lower than
// this.
//
// This setting makes the kernel perform speculative reads that do not
// originate from any client process. This usually tremendously
// improves read performance.
func MaxReadahead(n uint32) MountOption {
	return func(conf *mountConfig) error {
		conf.maxReadahead = n
		return nil
	}
}

// AsyncRead enables multiple outstanding read requests for the same
// handle. Without this, there is at most one request in flight at a
// time.
func AsyncRead() MountOption {
	return func(conf *mountConfig) error {
		conf.initFlags |= InitAsyncRead
		return nil
	}
}

// WritebackCache enables the kernel to buffer writes before sending
// them to the FUSE server. Without this, writethrough caching is
// used.
func WritebackCache() MountOption {
	return func(conf *mountConfig) error {
		conf.initFlags |= InitWritebackCache
		return nil
	}
}

// OSXFUSEPaths describes the paths used by an installed OSXFUSE
// version. See OSXFUSELocationV3 for typical values.
type OSXFUSEPaths struct {
	// Prefix for the device file. At mount time, an incrementing
	// number is suffixed until a free FUSE device is found.
	DevicePrefix string
	// Path of the load helper, used to load the kernel extension if
	// no device files are found.
	Load string
	// Path of the mount helper, used for the actual mount operation.
	Mount string
	// Environment variable used to pass the path to the executable
	// calling the mount helper.
	DaemonVar string
}

// Default paths for OSXFUSE. See OSXFUSELocations.
var (
	OSXFUSELocationV3 = OSXFUSEPaths{
		DevicePrefix: "/dev/osxfuse",
		Load:         "/Library/Filesystems/osxfuse.fs/Contents/Resources/load_osxfuse",
		Mount:        "/Library/Filesystems/osxfuse.fs/Contents/Resources/mount_osxfuse",
		DaemonVar:    "MOUNT_OSXFUSE_DAEMON_PATH",
	}
	OSXFUSELocationV2 = OSXFUSEPaths{
		DevicePrefix: "/dev/osxfuse",
		Load:         "/Library/Filesystems/osxfusefs.fs/Support/load_osxfusefs",
		Mount:        "/Library/Filesystems/osxfusefs.fs/Support/mount_osxfusefs",
		DaemonVar:    "MOUNT_FUSEFS_DAEMON_PATH",
	}
)

// OSXFUSELocations sets where to look for OSXFUSE files. The
// arguments are all the possible locations. The previous locations
// are replaced.
//
// Without this option, OSXFUSELocationV3 and OSXFUSELocationV2 are
// used.
//
// OS X only. Others ignore this option.
func OSXFUSELocations(paths ...OSXFUSEPaths) MountOption {
	return func(conf *mountConfig) error {
		if len(paths) == 0 {
			return errors.New("must specify at least one location for OSXFUSELocations")
		}
		// replace previous values, but make a copy so there's no
		// worries about caller mutating their slice
		conf.osxfuseLocations = append(conf.osxfuseLocations[:0], paths...)
		return nil
	}
}
