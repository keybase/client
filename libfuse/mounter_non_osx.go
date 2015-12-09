// +build !darwin

package libfuse

import "bazil.org/fuse"

func getPlatformSpecificMountOptions(dir string) ([]fuse.MountOption, error) {
	return []fuse.MountOption{}, nil
}
