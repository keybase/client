// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"bytes"
	"io"
	"sync"
	"sync/atomic"

	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	billy "gopkg.in/src-d/go-billy.v4"
)

// File is a wrapper around a libkbfs.Node that implements the
// billy.File interface.
type File struct {
	fs *FS
	// NOTE: If filename ever becomes mutable, we should have a way to keep
	// lockID constant.
	filename string
	node     libkbfs.Node
	readOnly bool
	offset   int64

	lockedLock sync.Mutex
	locked     bool
}

var _ billy.File = (*File)(nil)

// Name implements the billy.File interface for File.
func (f *File) Name() string {
	return f.filename
}

func (f *File) updateOffset(origOffset, advanceBytes int64) {
	// If there are two concurrent Write calls at the same time, it's
	// not well-defined what the offset should be after.  Just set it
	// to what this call thinks it should be and let the application
	// sort things out.
	_ = atomic.SwapInt64(&f.offset, origOffset+advanceBytes)
}

// Write implements the billy.File interface for File.
func (f *File) Write(p []byte) (n int, err error) {
	if f.readOnly {
		return 0, errors.New("Trying to write a read-only file")
	}

	origOffset := atomic.LoadInt64(&f.offset)
	err = f.fs.config.KBFSOps().Write(f.fs.ctx, f.node, p, origOffset)
	if err != nil {
		return 0, err
	}

	f.updateOffset(origOffset, int64(len(p)))
	return len(p), nil
}

// Read implements the billy.File interface for File.
func (f *File) Read(p []byte) (n int, err error) {
	origOffset := atomic.LoadInt64(&f.offset)
	readBytes, err := f.fs.config.KBFSOps().Read(
		f.fs.ctx, f.node, p, origOffset)
	if err != nil {
		return 0, err
	}

	if readBytes == 0 {
		return 0, io.EOF
	}

	f.updateOffset(origOffset, readBytes)
	return int(readBytes), nil
}

// ReadAt implements the billy.File interface for File.
func (f *File) ReadAt(p []byte, off int64) (n int, err error) {
	// ReadAt doesn't affect the underlying offset.
	readBytes, err := f.fs.config.KBFSOps().Read(f.fs.ctx, f.node, p, off)
	if err != nil {
		return 0, err
	}
	if int(readBytes) < len(p) {
		// ReadAt is more strict than Read.
		return 0, errors.Errorf("Could only read %d bytes", readBytes)
	}

	return int(readBytes), nil
}

// Seek implements the billy.File interface for File.
func (f *File) Seek(offset int64, whence int) (n int64, err error) {
	newOffset := offset
	switch whence {
	case io.SeekStart:
	case io.SeekCurrent:
		origOffset := atomic.LoadInt64(&f.offset)
		newOffset = origOffset + offset
	case io.SeekEnd:
		ei, err := f.fs.config.KBFSOps().Stat(f.fs.ctx, f.node)
		if err != nil {
			return 0, err
		}
		newOffset = int64(ei.Size) + offset
	}
	if newOffset < 0 {
		return 0, errors.Errorf("Cannot seek to offset %d", newOffset)
	}

	_ = atomic.SwapInt64(&f.offset, newOffset)
	return newOffset, nil
}

// Close implements the billy.File interface for File.
func (f *File) Close() error {
	err := f.Unlock()
	if err != nil {
		return err
	}
	f.node = nil
	return nil
}

func (f *File) getLockID() keybase1.LockID {
	// If we ever change this lock ID format, we must first come up with a
	// transition plan and then upgrade all clients before transitioning.
	return keybase1.LockIDFromBytes(
		bytes.Join([][]byte{
			f.fs.GetLockNamespace(),
			[]byte(f.Name()),
		}, []byte{'/'}))
}

// Lock implements the billy.File interface for File.
func (f *File) Lock() (err error) {
	done := make(chan struct{})
	f.fs.sendEvents(FSEvent{
		EventType: FSEventLock,
		File:      f,
		Done:      done,
	})
	defer close(done)
	f.lockedLock.Lock()
	defer f.lockedLock.Unlock()
	if f.locked {
		return nil
	}
	defer func() {
		if err == nil {
			f.locked = true
		}
	}()

	// First, sync all and ask journal to flush all existing writes.
	err = f.fs.SyncAll()
	if err != nil {
		return err
	}
	jManager, err := libkbfs.GetJournalManager(f.fs.config)
	if err != nil {
		return err
	}
	if err = jManager.FinishSingleOp(f.fs.ctx,
		f.fs.root.GetFolderBranch().Tlf, nil, f.fs.priority); err != nil {
		return err
	}

	// Now, sync up with the server, while making sure a lock is held by us. If
	// lock taking fails, RPC layer retries automatically.
	lockID := f.getLockID()
	return f.fs.config.KBFSOps().SyncFromServer(f.fs.ctx,
		f.fs.root.GetFolderBranch(), &lockID)
}

// Unlock implements the billy.File interface for File.
func (f *File) Unlock() (err error) {
	f.lockedLock.Lock()
	defer f.lockedLock.Unlock()
	if !f.locked {
		return nil
	}

	// Send the event only if f.locked == true.
	done := make(chan struct{})
	f.fs.sendEvents(FSEvent{
		EventType: FSEventUnlock,
		File:      f,
		Done:      done,
	})
	defer close(done)

	defer func() {
		if err == nil {
			f.locked = false
		}
	}()

	err = f.fs.SyncAll()
	if err != nil {
		return err
	}
	jManager, err := libkbfs.GetJournalManager(f.fs.config)
	if err != nil {
		return err
	}
	jStatus, _ := jManager.JournalStatus(f.fs.root.GetFolderBranch().Tlf)
	if jStatus.RevisionStart == kbfsmd.RevisionUninitialized {
		// Journal MDs are all flushed and we haven't made any more writes.
		// Calling FinishSingleOp won't make it to the server, so we make a
		// naked request to server just to release the lock.
		return f.fs.config.MDServer().ReleaseLock(f.fs.ctx,
			f.fs.root.GetFolderBranch().Tlf, f.getLockID())
	}

	if f.fs.config.Mode().Type() == libkbfs.InitSingleOp {
		err = jManager.FinishSingleOp(f.fs.ctx,
			f.fs.root.GetFolderBranch().Tlf, &keybase1.LockContext{
				RequireLockID:       f.getLockID(),
				ReleaseAfterSuccess: true,
			}, f.fs.priority)
		if err != nil {
			return err
		}
	} else {
		err = jManager.WaitForCompleteFlush(
			f.fs.ctx, f.fs.root.GetFolderBranch().Tlf)
		if err != nil {
			return err
		}

		f.fs.log.CDebugf(f.fs.ctx, "Releasing the lock")

		// Need to explicitly release the lock from the server. If
		// single-op mode isn't enabled, then the journal will be
		// flushing on its own without waiting for the call to
		// `FinishSingleOp`. That means the journal can already be
		// completely flushed by the time `FinishSingleOp` is called,
		// and it will be a no-op. It won't have made any call to the
		// server to release the lock, so we have to do it explicitly
		// here.
		err = f.fs.config.MDServer().ReleaseLock(
			f.fs.ctx, f.fs.root.GetFolderBranch().Tlf, f.getLockID())
		if err != nil {
			return err
		}
	}
	return nil
}

// Truncate implements the billy.File interface for File.
func (f *File) Truncate(size int64) error {
	return f.fs.config.KBFSOps().Truncate(f.fs.ctx, f.node, uint64(size))
}

// GetNode returns the libkbfs.Node associated with this file.
func (f *File) GetNode() libkbfs.Node {
	return f.node
}
