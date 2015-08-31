package libfuse

import (
	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"golang.org/x/net/context"
)

// ErrorFile represents a file containing the text of the most recent
// KBFS error.
type ErrorFile struct {
	fs *FS
}

var _ fs.Node = (*ErrorFile)(nil)

// Attr implements the fs.Node interface for ErrorFile.
func (f *ErrorFile) Attr(ctx context.Context, a *fuse.Attr) error {
	re := f.fs.config.Reporter().LastError()
	a.Size = uint64(len(re.Error.String())) + 1
	if re.Error != nil {
		a.Mtime = re.Time
		a.Ctime = re.Time
	}
	a.Mode = 0444
	return nil
}

var _ fs.Handle = (*ErrorFile)(nil)

var _ fs.NodeOpener = (*ErrorFile)(nil)

// Open implements the fs.NodeOpener interface for ErrorFile.
func (f *ErrorFile) Open(ctx context.Context, req *fuse.OpenRequest,
	resp *fuse.OpenResponse) (fs.Handle, error) {
	re := f.fs.config.Reporter().LastError()
	return fs.DataHandle([]byte(re.Error.String() + "\n")), nil
}
