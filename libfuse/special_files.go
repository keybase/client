package libfuse

import (
	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/kbfs/libkbfs"
)

func handleSpecialFile(name string, fs *FS, resp *fuse.LookupResponse) fs.Node {
	switch name {
	case libkbfs.ErrorFile:
		return NewErrorFile(fs, resp)
	case MetricsFileName:
		return NewMetricsFile(fs, resp)
	case ProfileListDirName:
		return ProfileList{}
	}

	return nil
}
