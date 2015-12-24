package libfuse

import (
	"os"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"golang.org/x/net/context"
)

// EmptyFolder represents an empty, read-only KBFS TLF that has not
// been created by someone with sufficient permissions.
type EmptyFolder struct {
	fs *FS
}

var _ fs.Node = (*EmptyFolder)(nil)

// Attr implements the fs.Node interface for EmptyFolder.
func (ef *EmptyFolder) Attr(ctx context.Context, a *fuse.Attr) (err error) {
	ctx = NewContextWithOpID(ctx, ef.fs.log)
	ef.fs.log.CDebugf(ctx, "Empty folder Attr")
	defer func() { ef.fs.reportErr(ctx, err) }()

	a.Mode = os.ModeDir | 0700
	return nil
}

var _ fs.NodeRequestLookuper = (*EmptyFolder)(nil)

// Lookup implements the fs.NodeRequestLookuper interface for EmptyFolder.
func (ef *EmptyFolder) Lookup(ctx context.Context, req *fuse.LookupRequest,
	resp *fuse.LookupResponse) (node fs.Node, err error) {
	ctx = NewContextWithOpID(ctx, ef.fs.log)
	ef.fs.log.CDebugf(ctx, "EmptyFolder Lookup %s", req.Name)
	defer func() { ef.fs.reportErr(ctx, err) }()

	return nil, fuse.ENOENT
}

var _ fs.Handle = (*EmptyFolder)(nil)

var _ fs.HandleReadDirAller = (*EmptyFolder)(nil)

// ReadDirAll implements the fs.NodeReadDirAller interface for EmptyFolder.
func (ef *EmptyFolder) ReadDirAll(ctx context.Context) (
	res []fuse.Dirent, err error) {
	ctx = NewContextWithOpID(ctx, ef.fs.log)
	ef.fs.log.CDebugf(ctx, "EmptyFolder ReadDirAll")
	defer func() { ef.fs.reportErr(ctx, err) }()

	return res, nil
}
