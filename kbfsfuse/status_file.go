package main

import (
	"encoding/json"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"golang.org/x/net/context"
)

// StatusFileName is the name of the KBFS status file -- it can be
// reached anywhere within a top-level folder.
const StatusFileName = ".kbfs_status"

// StatusFile represents a file containing the current JSON-encoded
// status of the given top-level folder.
type StatusFile struct {
	folder *Folder
}

var _ fs.Node = (*StatusFile)(nil)

func (f *StatusFile) encodedStatus(ctx context.Context) ([]byte, error) {
	status, _, err := f.folder.fs.config.KBFSOps().
		Status(ctx, f.folder.folderBranch)
	if err != nil {
		return nil, err
	}
	mStatus, err := json.MarshalIndent(status, "", "  ")
	if err != nil {
		return nil, err
	}
	return append(mStatus, '\n'), nil
}

// Attr implements the fs.Node interface for StatusFile.
func (f *StatusFile) Attr(ctx context.Context, a *fuse.Attr) error {
	status, err := f.encodedStatus(ctx)
	if err != nil {
		return err
	}
	a.Size = uint64(len(status))
	a.Mode = 0444
	return nil
}

var _ fs.Handle = (*StatusFile)(nil)

var _ fs.NodeOpener = (*StatusFile)(nil)

// Open implements the fs.NodeOpener interface for StatusFile.
func (f *StatusFile) Open(ctx context.Context, req *fuse.OpenRequest,
	resp *fuse.OpenResponse) (fs.Handle, error) {
	status, err := f.encodedStatus(ctx)
	if err != nil {
		return nil, err
	}
	return fs.DataHandle(status), nil
}
