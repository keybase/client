package libfuse

import (
	"encoding/json"
	"sync"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// StatusFileName is the name of the KBFS status file -- it can be
// reached anywhere within a top-level folder.
const StatusFileName = ".kbfs_status"

// StatusFile represents a file containing the current JSON-encoded
// status of the given top-level folder. Each instance saves exactly
// one immutable version of the status.  This is because on OSX, we
// get an Attr call after the Open call (before the Read, which
// doesn't come here), and if Attr returns more bytes than Open put
// into the DataHandle, it will return a bunch of garbage after the
// status text.
type StatusFile struct {
	folder *Folder
	once   sync.Once
	status []byte
}

var _ fs.Node = (*StatusFile)(nil)

func (f *StatusFile) saveEncodedStatus(ctx context.Context) error {
	var err error
	f.once.Do(func() {
		var status libkbfs.FolderBranchStatus
		status, _, err = f.folder.fs.config.KBFSOps().
			Status(ctx, f.folder.folderBranch)
		if err != nil {
			return
		}
		mStatus, err := json.MarshalIndent(status, "", "  ")
		if err != nil {
			return
		}
		f.status = append(mStatus, '\n')
	})
	return err
}

// Attr implements the fs.Node interface for StatusFile.
func (f *StatusFile) Attr(ctx context.Context, a *fuse.Attr) error {
	ctx = NewContextWithOpID(ctx, f.folder.fs.log)
	if err := f.saveEncodedStatus(ctx); err != nil {
		return err
	}
	a.Size = uint64(len(f.status))
	a.Mode = 0444
	return nil
}

var _ fs.Handle = (*StatusFile)(nil)

var _ fs.NodeOpener = (*StatusFile)(nil)

// Open implements the fs.NodeOpener interface for StatusFile.
func (f *StatusFile) Open(ctx context.Context, req *fuse.OpenRequest,
	resp *fuse.OpenResponse) (fs.Handle, error) {
	ctx = NewContextWithOpID(ctx, f.folder.fs.log)
	if err := f.saveEncodedStatus(ctx); err != nil {
		return nil, err
	}
	return fs.DataHandle(f.status), nil
}
