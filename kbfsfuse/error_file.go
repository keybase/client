package main

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

// Attr implements the fs.Node interface for File.
func (f *ErrorFile) Attr(ctx context.Context, a *fuse.Attr) error {
	data, etime := f.fs.config.Reporter().LastError()
	a.Size = uint64(len(data)) + 1
	if etime != nil {
		a.Mtime = *etime
		a.Ctime = *etime
	}
	a.Mode = 0444
	return nil
}

var _ fs.Handle = (*ErrorFile)(nil)

var _ fs.NodeOpener = (*ErrorFile)(nil)

// Open implements the fs.NodeOpener interface for File.
func (f *ErrorFile) Open(ctx context.Context, req *fuse.OpenRequest,
	resp *fuse.OpenResponse) (fs.Handle, error) {
	data, _ := f.fs.config.Reporter().LastError()
	data += "\n"
	return fs.DataHandle([]byte(data)), nil
}
