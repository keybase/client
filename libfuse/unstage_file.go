package libfuse

import (
	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// UnstageFile represents a write-only file when any write of at least
// one byte triggers unstaging all unmerged commits and
// fast-forwarding to the current master.  TODO: remove this file once
// we have automatic conflict resolution.
type UnstageFile struct {
	folder *Folder
}

var _ fs.Node = (*UnstageFile)(nil)

// Attr implements the fs.Node interface for UnstageFile.
func (f *UnstageFile) Attr(ctx context.Context, a *fuse.Attr) error {
	a.Size = 0
	a.Mode = 0222
	return nil
}

var _ fs.Handle = (*UnstageFile)(nil)

var _ fs.HandleWriter = (*UnstageFile)(nil)

// Write implements the fs.HandleWriter interface for UnstageFile.
func (f *UnstageFile) Write(ctx context.Context, req *fuse.WriteRequest,
	resp *fuse.WriteResponse) (err error) {
	f.folder.fs.log.CDebugf(ctx, "UnstageFile Write")
	defer func() { f.folder.reportErr(ctx, libkbfs.WriteMode, err) }()
	if len(req.Data) == 0 {
		return nil
	}
	err = f.folder.fs.config.KBFSOps().
		UnstageForTesting(ctx, f.folder.getFolderBranch())
	if err != nil {
		return err
	}
	resp.Size = len(req.Data)
	return nil
}
