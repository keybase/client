// +build !darwin

package libfuse

import "bazil.org/fuse"

func getPlatformSpecificMountOptions(dir string, platformParams PlatformParams) ([]fuse.MountOption, error) {
	return []fuse.MountOption{}, nil
}

func getPlatformSpecificMountOptionsForTest() []fuse.MountOption {
	return []fuse.MountOption{}
}

func translatePlatformSpecificError(err error, platformParams PlatformParams) error {
	return err
}
