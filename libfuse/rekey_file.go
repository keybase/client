package libfuse

import (
	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"golang.org/x/net/context"
)

// RekeyFileName is the name of the KBFS unstaging file -- it can be
// reached anywhere within a top-level folder.
const RekeyFileName = ".kbfs_rekey"

// RekeyFile represents a write-only file when any write of at least
// one byte triggers a rekey of the folder.
type RekeyFile struct {
	folder *Folder
}

var _ fs.Node = (*RekeyFile)(nil)

// Attr implements the fs.Node interface for RekeyFile.
func (f *RekeyFile) Attr(ctx context.Context, a *fuse.Attr) error {
	a.Size = 0
	a.Mode = 0222
	return nil
}

var _ fs.Handle = (*RekeyFile)(nil)

var _ fs.HandleWriter = (*RekeyFile)(nil)

// Write implements the fs.HandleWriter interface for RekeyFile.
func (f *RekeyFile) Write(ctx context.Context, req *fuse.WriteRequest,
	resp *fuse.WriteResponse) (err error) {
	ctx = NewContextWithOpID(ctx, f.folder.fs.log)
	f.folder.fs.log.CDebugf(ctx, "RekeyFile Write")
	defer func() { f.folder.fs.reportErr(ctx, err) }()
	if len(req.Data) == 0 {
		return nil
	}
	err = f.folder.fs.config.KBFSOps().
		RekeyForTesting(ctx, f.folder.folderBranch)
	if err != nil {
		return err
	}
	resp.Size = len(req.Data)
	return nil
}
