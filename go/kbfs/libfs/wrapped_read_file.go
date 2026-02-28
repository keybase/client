// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"context"
	"io"
	"time"

	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/logger"
	"github.com/pkg/errors"
	billy "gopkg.in/src-d/go-billy.v4"
)

const (
	// Debug tag ID for an individual FS operation.
	ctxFSOpID = "FSID"
)

type ctxFSTagKey int

const (
	ctxFSIDKey ctxFSTagKey = iota
)

// wrappedReadFile is a read-only file that serves data from a given
// `reader` function.
type wrappedReadFile struct {
	name   string
	reader func(context.Context) ([]byte, time.Time, error)
	log    logger.Logger

	// TODO: proper locking for `nextRead` if we ever use it outside
	// of libkbfs node-wrapping (which always uses `ReadAt`).
	nextRead int
}

var _ billy.File = (*wrappedReadFile)(nil)

func (wrf *wrappedReadFile) getDataAndTime() ([]byte, time.Time) {
	ctx := libkbfs.CtxWithRandomIDReplayable(
		context.Background(), ctxFSIDKey, ctxFSOpID, nil)
	data, t, err := wrf.reader(ctx)
	if err != nil {
		wrf.log.CDebugf(ctx, "Couldn't read wrapped file: %+v", err)
		return nil, time.Time{}
	}
	return data, t
}

func (wrf *wrappedReadFile) Len() int {
	data, _ := wrf.getDataAndTime()
	return len(data)
}

func (wrf *wrappedReadFile) Name() string {
	return wrf.name
}

func (wrf *wrappedReadFile) Write(_ []byte) (n int, err error) {
	return 0, errors.New("wrapped read files can't be written")
}

func (wrf *wrappedReadFile) Read(p []byte) (n int, err error) {
	data, _ := wrf.getDataAndTime()

	if wrf.nextRead >= len(data) {
		return 0, io.EOF
	}
	n = copy(p, data[wrf.nextRead:])
	wrf.nextRead += n
	return n, nil
}

func (wrf *wrappedReadFile) ReadAt(p []byte, off int64) (n int, err error) {
	data, _ := wrf.getDataAndTime()

	if off >= int64(len(data)) {
		return 0, io.EOF
	}

	n = copy(p, data[off:])
	return n, nil
}

func (wrf *wrappedReadFile) Seek(offset int64, whence int) (int64, error) {
	newOffset := offset
	switch whence {
	case io.SeekStart:
	case io.SeekCurrent:
		newOffset = int64(wrf.nextRead) + offset
	case io.SeekEnd:
		data, _ := wrf.getDataAndTime()
		newOffset = int64(len(data)) + offset
	}
	if newOffset < 0 {
		return 0, errors.Errorf("Cannot seek to offset %d", newOffset)
	}

	wrf.nextRead = int(newOffset)
	return newOffset, nil
}

func (wrf *wrappedReadFile) Close() error {
	return nil
}

func (wrf *wrappedReadFile) Lock() error {
	return errors.New("wrapped read files can't be locked")
}

func (wrf *wrappedReadFile) Unlock() error {
	return errors.New("wrapped read files can't be unlocked")
}

func (wrf *wrappedReadFile) Truncate(size int64) error {
	return errors.New("wrapped read files can't be truncated")
}

func (wrf *wrappedReadFile) GetInfo() *wrappedReadFileInfo {
	data, t := wrf.getDataAndTime()
	return &wrappedReadFileInfo{
		name:  wrf.Name(),
		size:  int64(len(data)),
		mtime: t,
	}
}
