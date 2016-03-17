// +build !darwin

package libfuse

import "bazil.org/fuse"

func getPlatformSpecificMountOptions(dir string, platformParams PlatformParams) ([]fuse.MountOption, error) {
	return []fuse.MountOption{}, nil
}

func translatePlatformSpecificError(err error, platformParams PlatformParams) error {
	return err
}
