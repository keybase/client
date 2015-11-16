// +build !darwin

package libfuse

import "bazil.org/fuse"

func getPlatformSpecificMountOptions(m Mounter) ([]fuse.MountOption, error) {
	return []fuse.MountOption{}, nil
}
