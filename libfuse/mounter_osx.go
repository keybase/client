// +build darwin

package libfuse

import "bazil.org/fuse"

func getPlatformSpecificMountOptions(dir string) ([]fuse.MountOption, error) {
	options := []fuse.MountOption{}

	// Add kbfuse support.
	kbfusePath := fuse.OSXFUSEPaths{
		DevicePrefix: "/dev/kbfuse",
		Load:         "/Library/Filesystems/kbfuse.fs/Contents/Resources/load_kbfuse",
		Mount:        "/Library/Filesystems/kbfuse.fs/Contents/Resources/mount_kbfuse",
		DaemonVar:    "MOUNT_KBFUSE_DAEMON_PATH",
	}
	// Allow both kbfuse and osxfuse 3.x locations by default.
	options = append(options, fuse.OSXFUSELocations(kbfusePath, fuse.OSXFUSELocationV3))

	// Volume name option is only used on OSX (ignored on other platforms).
	volName, err := volumeName(dir)
	if err != nil {
		return nil, err
	}

	options = append(options, fuse.VolumeName(volName))

	return options, nil
}
