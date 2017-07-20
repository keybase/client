// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build darwin

package libfuse

import (
	"errors"

	"bazil.org/fuse"
)

var kbfusePath = fuse.OSXFUSEPaths{
	DevicePrefix: "/dev/kbfuse",
	Load:         "/Library/Filesystems/kbfuse.fs/Contents/Resources/load_kbfuse",
	Mount:        "/Library/Filesystems/kbfuse.fs/Contents/Resources/mount_kbfuse",
	DaemonVar:    "MOUNT_KBFUSE_DAEMON_PATH",
}

func getPlatformSpecificMountOptions(dir string, platformParams PlatformParams) ([]fuse.MountOption, error) {
	options := []fuse.MountOption{}

	var locationOption fuse.MountOption
	if platformParams.UseSystemFuse {
		// Only allow osxfuse 3.x.
		locationOption = fuse.OSXFUSELocations(fuse.OSXFUSELocationV3)
	} else {
		// Only allow kbfuse.
		locationOption = fuse.OSXFUSELocations(kbfusePath)
	}
	options = append(options, locationOption)

	// Volume name option is only used on OSX (ignored on other platforms).
	volName, err := volumeName(dir)
	if err != nil {
		return nil, err
	}

	options = append(options, fuse.VolumeName(volName))
	options = append(options, fuse.ExclCreate())

	if platformParams.UseLocal {
		options = append(options, fuse.LocalVolume())
	}

	return options, nil
}

// GetPlatformSpecificMountOptionsForTest makes cross-platform tests work
func GetPlatformSpecificMountOptionsForTest() []fuse.MountOption {
	// For now, test with either kbfuse or OSXFUSE for now.
	// TODO: Consider mandate testing with kbfuse?
	return []fuse.MountOption{
		fuse.OSXFUSELocations(kbfusePath, fuse.OSXFUSELocationV3),
		fuse.ExclCreate(),

		// We are diabling the 'local' mount option in tests for now since it
		// causes out tests to leave a bunch of entries behind in Finder's sidebar.
		// TODO: fix this.
		// fuse.LocalVolume(),
	}
}

func translatePlatformSpecificError(err error, platformParams PlatformParams) error {
	if err == fuse.ErrOSXFUSENotFound {
		if platformParams.UseSystemFuse {
			return errors.New(
				"cannot locate OSXFUSE 3.x")
		}
		return errors.New(
			"cannot locate kbfuse; either install the Keybase " +
				"app, or install OSXFUSE 3.x " +
				"and pass in --use-system-fuse")
	}
	return err
}
