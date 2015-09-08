package libfuse

import (
	"time"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"golang.org/x/net/context"
)

// SpecialReadFile represents a file whose contents are determined by
// a function.
type SpecialReadFile struct {
	read func() ([]byte, time.Time, error)
}

var _ fs.Node = (*SpecialReadFile)(nil)

// Attr implements the fs.Node interface for SpecialReadFile.
func (f *SpecialReadFile) Attr(ctx context.Context, a *fuse.Attr) error {
	data, t, err := f.read()
	if err != nil {
		return err
	}

	// Some apps (e.g., Chrome) get confused if we use a 0 size
	// here, as is usual for pseudofiles. So return the actual
	// size, even though it may be racy.
	a.Size = uint64(len(data))
	a.Mtime = t
	a.Ctime = t
	a.Mode = 0444
	return nil
}

var _ fs.Handle = (*SpecialReadFile)(nil)

var _ fs.NodeOpener = (*SpecialReadFile)(nil)

// Open implements the fs.NodeOpener interface for SpecialReadFile.
func (f *SpecialReadFile) Open(ctx context.Context, req *fuse.OpenRequest,
	resp *fuse.OpenResponse) (fs.Handle, error) {
	data, _, err := f.read()
	if err != nil {
		return nil, err
	}

	resp.Flags |= fuse.OpenDirectIO
	return fs.DataHandle(data), nil
}
