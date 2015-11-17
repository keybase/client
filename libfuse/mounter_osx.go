// +build darwin

package libfuse

import (
	"os"

	"bazil.org/fuse"
)

func getPlatformSpecificMountOptions(m Mounter) ([]fuse.MountOption, error) {
	options := []fuse.MountOption{}

	// Add kbfuse support.
	// Workaround osxfuse and bazil.org/fuse issue with a required env for the
	// daemon path. The issue is being tracked here: https://github.com/bazil/fuse/issues/113
	os.Setenv("MOUNT_KBFUSE_DAEMON_PATH", "/Library/Filesystems/kbfuse.fs/Contents/Resources/mount_kbfuse")

	kbfusePath := fuse.OSXFUSEPaths{
		DevicePrefix: "/dev/kbfuse",
		Load:         "/Library/Filesystems/kbfuse.fs/Contents/Resources/load_kbfuse",
		Mount:        "/Library/Filesystems/kbfuse.fs/Contents/Resources/mount_kbfuse",
	}
	// Allow both kbfuse and osxfuse 3.x locations by default.
	options = append(options, fuse.OSXFUSELocations(kbfusePath, fuse.OSXFUSELocationV3))

	// Volume name option is only used on OSX (ignored on other platforms).
	volName, err := volumeName(m.Dir())
	if err != nil {
		return nil, err
	}

	options = append(options, fuse.VolumeName(volName))

	return options, nil
}
