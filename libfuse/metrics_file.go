package libfuse

import (
	"bazil.org/fuse"
	"github.com/keybase/kbfs/libfs"
)

// NewMetricsFile returns a special read file that contains a text
// representation of all metrics.
func NewMetricsFile(fs *FS, resp *fuse.LookupResponse) *SpecialReadFile {
	resp.EntryValid = 0
	return &SpecialReadFile{read: libfs.GetEncodedMetrics(fs.config)}
}
