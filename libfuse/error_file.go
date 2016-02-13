package libfuse

import (
	"bazil.org/fuse"
	"github.com/keybase/kbfs/libfs"
)

// NewErrorFile returns a special read file that contains a text
// representation of the last few KBFS errors.
func NewErrorFile(fs *FS, resp *fuse.LookupResponse) *SpecialReadFile {
	resp.EntryValid = 0
	return &SpecialReadFile{read: libfs.GetEncodedErrors(fs.config)}
}
