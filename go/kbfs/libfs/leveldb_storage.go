// Copyright (c) 2012, Suryandaru Triandana <syndtr@gmail.com>
// All rights reservefs.
//
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// This is a modified version of
// github.com/syndtr/goleveldb/leveldb/storage/file_storage.go.
//
// Modifications: Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"errors"
	"fmt"
	"io"
	"os"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/syndtr/goleveldb/leveldb/storage"
	billy "gopkg.in/src-d/go-billy.v4"
)

var (
	errReadOnly = errors.New("leveldb/storage: storage is read-only")
)

type levelDBStorageLock struct {
	fs *levelDBStorage
}

func (lock *levelDBStorageLock) Unlock() {
	if lock.fs != nil {
		lock.fs.mu.Lock()
		defer lock.fs.mu.Unlock()
		if lock.fs.slock == lock {
			lock.fs.slock = nil
		}
	}
}

type int64Slice []int64

func (p int64Slice) Len() int           { return len(p) }
func (p int64Slice) Less(i, j int) bool { return p[i] < p[j] }
func (p int64Slice) Swap(i, j int)      { p[i], p[j] = p[j], p[i] }

const logSizeThreshold = 1024 * 1024 // 1 MiB

// levelDBStorage is a billy-filesystem-backed storage.
type levelDBStorage struct {
	fs       billy.Filesystem
	readOnly bool

	mu      sync.Mutex
	flock   billy.File
	slock   *levelDBStorageLock
	logw    billy.File
	logSize int64
	buf     []byte
	// Opened file counter; if open < 0 means closed.
	open int
	day  int

	syncLock sync.RWMutex // sync takes write lock, modifiers take read lock
}

var _ storage.Storage = (*levelDBStorage)(nil)

// OpenLevelDBStorage returns a new billy-filesystem-backed storage
// implementation of the levelDB storage interface. This also acquires
// a file lock, so any subsequent attempt to open the same path will
// fail.
func OpenLevelDBStorage(bfs billy.Filesystem, readOnly bool) (
	s storage.Storage, err error) {
	flock, err := bfs.OpenFile("LOCK", os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			flock.Close()
		}
	}()
	err = flock.Lock()
	if err != nil {
		return nil, err
	}

	var (
		logw    billy.File
		logSize int64
	)
	if !readOnly {
		logw, err = bfs.OpenFile("LOG", os.O_WRONLY|os.O_CREATE, 0644)
		if err != nil {
			return nil, err
		}
		logSize, err = logw.Seek(0, os.SEEK_END)
		if err != nil {
			logw.Close()
			return nil, err
		}
	}

	fs := &levelDBStorage{
		fs:       bfs,
		readOnly: readOnly,
		flock:    flock,
		logw:     logw,
		logSize:  logSize,
	}
	runtime.SetFinalizer(fs, (*levelDBStorage).Close)
	return fs, nil
}

func (fs *levelDBStorage) writeFileSyncedRLocked(
	filename string, data []byte, perm os.FileMode) error {
	f, err := fs.fs.OpenFile(filename, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, perm)
	if err != nil {
		return err
	}
	n, err := f.Write(data)
	if err == nil && n < len(data) {
		err = io.ErrShortWrite
	}
	if err1 := f.Close(); err == nil {
		err = err1
	}
	if err != nil {
		return err
	}
	return fs.syncRLocked()
}

func (fs *levelDBStorage) Lock() (storage.Locker, error) {
	fs.mu.Lock()
	defer fs.mu.Unlock()
	if fs.open < 0 {
		return nil, storage.ErrClosed
	}
	if fs.readOnly {
		return &levelDBStorageLock{}, nil
	}
	if fs.slock != nil {
		return nil, storage.ErrLocked
	}
	fs.slock = &levelDBStorageLock{fs: fs}
	return fs.slock, nil
}

func itoa(buf []byte, i int, wid int) []byte {
	u := uint(i)
	if u == 0 && wid <= 1 {
		return append(buf, '0')
	}

	// Assemble decimal in reverse order.
	var b [32]byte
	bp := len(b)
	for ; u > 0 || wid > 0; u /= 10 {
		bp--
		wid--
		b[bp] = byte(u%10) + '0'
	}
	return append(buf, b[bp:]...)
}

func (fs *levelDBStorage) printDay(t time.Time) {
	if fs.day == t.Day() {
		return
	}
	fs.day = t.Day()
	_, _ = fs.logw.Write([]byte("=============== " + t.Format("Jan 2, 2006 (MST)") + " ===============\n"))
}

func (fs *levelDBStorage) doLogRLocked(t time.Time, str string) {
	if fs.logSize > logSizeThreshold {
		// Rotate log file.
		fs.logw.Close()
		fs.logw = nil
		fs.logSize = 0
		err := fs.fs.Rename("LOG", "LOG.old")
		if err != nil {
			return
		}
	}
	if fs.logw == nil {
		var err error
		fs.logw, err = fs.fs.OpenFile("LOG", os.O_WRONLY|os.O_CREATE, 0644)
		if err != nil {
			return
		}
		// Force printDay on new log file.
		fs.day = 0
	}
	fs.printDay(t)
	hour, min, sec := t.Clock()
	msec := t.Nanosecond() / 1e3
	// time
	fs.buf = itoa(fs.buf[:0], hour, 2)
	fs.buf = append(fs.buf, ':')
	fs.buf = itoa(fs.buf, min, 2)
	fs.buf = append(fs.buf, ':')
	fs.buf = itoa(fs.buf, sec, 2)
	fs.buf = append(fs.buf, '.')
	fs.buf = itoa(fs.buf, msec, 6)
	fs.buf = append(fs.buf, ' ')
	// write
	fs.buf = append(fs.buf, []byte(str)...)
	fs.buf = append(fs.buf, '\n')
	n, _ := fs.logw.Write(fs.buf)
	fs.logSize += int64(n)
}

func (fs *levelDBStorage) Log(str string) {
	if !fs.readOnly {
		t := time.Now()
		fs.mu.Lock()
		defer fs.mu.Unlock()
		if fs.open < 0 {
			return
		}
		fs.syncLock.RLock()
		defer fs.syncLock.RUnlock()
		fs.doLogRLocked(t, str)
	}
}

func (fs *levelDBStorage) logRLocked(str string) {
	if !fs.readOnly {
		fs.doLogRLocked(time.Now(), str)
	}
}

func (fs *levelDBStorage) log(str string) {
	if !fs.readOnly {
		fs.syncLock.RLock()
		defer fs.syncLock.RUnlock()
		fs.doLogRLocked(time.Now(), str)
	}
}

func (fs *levelDBStorage) syncLocked() (err error) {
	// Force a sync with a lock/unlock cycle, since the billy
	// interface doesn't have an explicit sync call.
	const syncLockName = "sync.lock"
	f, err := fs.fs.OpenFile(syncLockName, os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		return err
	}
	defer func() {
		closeErr := f.Close()
		if err == nil {
			err = closeErr
		}
	}()
	return f.Lock()
}

func (fs *levelDBStorage) sync() (err error) {
	fs.syncLock.Lock()
	defer fs.syncLock.Unlock()
	return fs.syncLocked()
}

func (fs *levelDBStorage) syncRLocked() (err error) {
	fs.syncLock.RUnlock()
	defer fs.syncLock.RLock()
	return fs.sync()
}

func (fs *levelDBStorage) setMetaRLocked(fd storage.FileDesc) error {
	content := fsGenName(fd) + "\n"
	// Check and backup old CURRENT file.
	currentPath := "CURRENT"
	if _, err := fs.fs.Stat(currentPath); err == nil {
		f, err := fs.fs.Open(currentPath)
		if err != nil {
			return err
		}
		defer f.Close()
		b, err := io.ReadAll(f)
		if err != nil {
			fs.logRLocked(fmt.Sprintf("backup CURRENT: %v", err))
			return err
		}
		if string(b) == content {
			// Content not changed, do nothing.
			return nil
		}
		if err := fs.writeFileSyncedRLocked(
			currentPath+".bak", b, 0644); err != nil {
			fs.logRLocked(fmt.Sprintf("backup CURRENT: %v", err))
			return err
		}
	} else if !os.IsNotExist(err) {
		return err
	}
	path := fmt.Sprintf("CURRENT.%d", fd.Num)
	if err := fs.writeFileSyncedRLocked(
		path, []byte(content), 0644); err != nil {
		fs.logRLocked(fmt.Sprintf("create CURRENT.%d: %v", fd.Num, err))
		return err
	}
	// Replace CURRENT file.
	if err := fs.fs.Rename(path, currentPath); err != nil {
		fs.logRLocked(fmt.Sprintf("rename CURRENT.%d: %v", fd.Num, err))
		return err
	}
	return fs.syncRLocked()
}

func (fs *levelDBStorage) setMeta(fd storage.FileDesc) error {
	fs.syncLock.RLock()
	defer fs.syncLock.RUnlock()
	return fs.setMetaRLocked(fd)
}

func (fs *levelDBStorage) SetMeta(fd storage.FileDesc) error {
	fs.syncLock.RLock()
	defer fs.syncLock.RUnlock()

	if !storage.FileDescOk(fd) {
		return storage.ErrInvalidFile
	}
	if fs.readOnly {
		return errReadOnly
	}

	fs.mu.Lock()
	defer fs.mu.Unlock()
	if fs.open < 0 {
		return storage.ErrClosed
	}
	return fs.setMetaRLocked(fd)
}

func isCorrupted(err error) bool {
	switch err.(type) {
	case *storage.ErrCorrupted:
		return true
	default:
		return false
	}
}

func (fs *levelDBStorage) GetMeta() (storage.FileDesc, error) {
	fs.mu.Lock()
	defer fs.mu.Unlock()
	if fs.open < 0 {
		return storage.FileDesc{}, storage.ErrClosed
	}
	fis, err := fs.fs.ReadDir("")
	if err != nil {
		return storage.FileDesc{}, err
	}
	// Try this in order:
	// - CURRENT.[0-9]+ ('pending rename' file, descending order)
	// - CURRENT
	// - CURRENT.bak
	//
	// Skip corrupted file or file that point to a missing target file.
	type currentFile struct {
		name string
		fd   storage.FileDesc
	}
	tryCurrent := func(name string) (*currentFile, error) {
		f, err := fs.fs.Open(name)
		if err != nil {
			if os.IsNotExist(err) {
				err = os.ErrNotExist
			}
			return nil, err
		}
		defer f.Close()
		b, err := io.ReadAll(f)
		if err != nil {
			return nil, err
		}
		var fd storage.FileDesc
		if len(b) < 1 || b[len(b)-1] != '\n' || !fsParseNamePtr(string(b[:len(b)-1]), &fd) {
			fs.logRLocked(fmt.Sprintf("%s: corrupted content: %q", name, b))
			err := &storage.ErrCorrupted{
				Err: fmt.Errorf("leveldb/storage: corrupted or incomplete CURRENT file %s %q", name, b),
			}
			return nil, err
		}
		if _, err := fs.fs.Stat(fsGenName(fd)); err != nil {
			if os.IsNotExist(err) {
				fs.logRLocked(
					fmt.Sprintf("%s: missing target file: %s", name, fd))
				err = os.ErrNotExist
			}
			return nil, err
		}
		return &currentFile{name: name, fd: fd}, nil
	}
	tryCurrents := func(names []string) (*currentFile, error) {
		var (
			cur *currentFile
			// Last corruption error.
			lastCerr error
		)
		for _, name := range names {
			var err error
			cur, err = tryCurrent(name)
			if err == nil {
				break
			} else if err == os.ErrNotExist {
				// Fallback to the next file.
			} else if isCorrupted(err) {
				lastCerr = err
				// Fallback to the next file.
			} else {
				// In case the error is due to permission, etc.
				return nil, err
			}
		}
		if cur == nil {
			err := os.ErrNotExist
			if lastCerr != nil {
				err = lastCerr
			}
			return nil, err
		}
		return cur, nil
	}

	// Try 'pending rename' files.
	var nums []int64
	for _, fi := range fis {
		name := fi.Name()
		if strings.HasPrefix(name, "CURRENT.") && name != "CURRENT.bak" {
			i, err := strconv.ParseInt(name[8:], 10, 64)
			if err == nil {
				nums = append(nums, i)
			}
		}
	}
	var (
		pendCur   *currentFile
		pendErr   = os.ErrNotExist
		pendNames []string
	)
	if len(nums) > 0 {
		sort.Sort(sort.Reverse(int64Slice(nums)))
		pendNames = make([]string, len(nums))
		for i, num := range nums {
			pendNames[i] = fmt.Sprintf("CURRENT.%d", num)
		}
		pendCur, pendErr = tryCurrents(pendNames)
		if pendErr != nil && pendErr != os.ErrNotExist && !isCorrupted(pendErr) {
			return storage.FileDesc{}, pendErr
		}
	}

	// Try CURRENT and CURRENT.bak.
	curCur, curErr := tryCurrents([]string{"CURRENT", "CURRENT.bak"})
	if curErr != nil && curErr != os.ErrNotExist && !isCorrupted(curErr) {
		return storage.FileDesc{}, curErr
	}

	// pendCur takes precedence, but guards against obsolete pendCur.
	if pendCur != nil && (curCur == nil || pendCur.fd.Num > curCur.fd.Num) {
		curCur = pendCur
	}

	if curCur != nil {
		// Restore CURRENT file to proper state.
		if !fs.readOnly && (curCur.name != "CURRENT" || len(pendNames) != 0) {
			// Ignore setMeta errors, however don't delete obsolete files if we
			// catch error.
			if err := fs.setMeta(curCur.fd); err == nil {
				// Remove 'pending rename' files.
				for _, name := range pendNames {
					if err := fs.fs.Remove(name); err != nil {
						fs.logRLocked(fmt.Sprintf("remove %s: %v", name, err))
					}
				}
			}
		}
		return curCur.fd, nil
	}

	// Nothing found.
	if isCorrupted(pendErr) {
		return storage.FileDesc{}, pendErr
	}
	return storage.FileDesc{}, curErr
}

func (fs *levelDBStorage) List(ft storage.FileType) (fds []storage.FileDesc, err error) {
	fs.mu.Lock()
	defer fs.mu.Unlock()
	if fs.open < 0 {
		return nil, storage.ErrClosed
	}
	fis, err := fs.fs.ReadDir("")
	if err != nil {
		return nil, err
	}
	if err == nil {
		for _, fi := range fis {
			if fd, ok := fsParseName(fi.Name()); ok && fd.Type&ft != 0 {
				fds = append(fds, fd)
			}
		}
	}
	return
}

func (fs *levelDBStorage) Open(fd storage.FileDesc) (storage.Reader, error) {
	if !storage.FileDescOk(fd) {
		return nil, storage.ErrInvalidFile
	}

	fs.mu.Lock()
	defer fs.mu.Unlock()
	if fs.open < 0 {
		return nil, storage.ErrClosed
	}
	of, err := fs.fs.OpenFile(fsGenName(fd), os.O_RDONLY, 0)
	if err != nil {
		if fsHasOldName(fd) && os.IsNotExist(err) {
			of, err = fs.fs.OpenFile(fsGenOldName(fd), os.O_RDONLY, 0)
			if err == nil {
				goto ok
			}
		}
		return nil, err
	}
ok:
	fs.open++
	return &fileWrap{File: of, fs: fs, fd: fd}, nil
}

func (fs *levelDBStorage) Create(fd storage.FileDesc) (storage.Writer, error) {
	fs.syncLock.RLock()
	defer fs.syncLock.RUnlock()

	if !storage.FileDescOk(fd) {
		return nil, storage.ErrInvalidFile
	}
	if fs.readOnly {
		return nil, errReadOnly
	}

	fs.mu.Lock()
	defer fs.mu.Unlock()
	if fs.open < 0 {
		return nil, storage.ErrClosed
	}
	of, err := fs.fs.OpenFile(fsGenName(fd), os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		return nil, err
	}
	fs.open++
	return &fileWrap{File: of, fs: fs, fd: fd}, nil
}

func (fs *levelDBStorage) Remove(fd storage.FileDesc) error {
	fs.syncLock.RLock()
	defer fs.syncLock.RUnlock()

	if !storage.FileDescOk(fd) {
		return storage.ErrInvalidFile
	}
	if fs.readOnly {
		return errReadOnly
	}

	fs.mu.Lock()
	defer fs.mu.Unlock()
	if fs.open < 0 {
		return storage.ErrClosed
	}
	err := fs.fs.Remove(fsGenName(fd))
	if err != nil {
		if fsHasOldName(fd) && os.IsNotExist(err) {
			if e1 := fs.fs.Remove(fsGenOldName(fd)); !os.IsNotExist(e1) {
				fs.logRLocked(fmt.Sprintf("remove %s: %v (old name)", fd, err))
				err = e1
			}
		} else {
			fs.logRLocked(fmt.Sprintf("remove %s: %v", fd, err))
		}
	}
	return err
}

func (fs *levelDBStorage) Rename(oldfd, newfd storage.FileDesc) error {
	fs.syncLock.RLock()
	defer fs.syncLock.RUnlock()

	if !storage.FileDescOk(oldfd) || !storage.FileDescOk(newfd) {
		return storage.ErrInvalidFile
	}
	if oldfd == newfd {
		return nil
	}
	if fs.readOnly {
		return errReadOnly
	}

	fs.mu.Lock()
	defer fs.mu.Unlock()
	if fs.open < 0 {
		return storage.ErrClosed
	}
	return fs.fs.Rename(fsGenName(oldfd), fsGenName(newfd))
}

func (fs *levelDBStorage) Close() error {
	fs.mu.Lock()
	defer fs.mu.Unlock()
	if fs.open < 0 {
		return storage.ErrClosed
	}
	// Clear the finalizer.
	runtime.SetFinalizer(fs, nil)

	if fs.open > 0 {
		fs.log(fmt.Sprintf("close: warning, %d files still open", fs.open))
	}
	fs.open = -1
	if fs.logw != nil {
		fs.logw.Close()
	}
	return fs.flock.Close()
}

type fileWrap struct {
	billy.File
	fs     *levelDBStorage
	fd     storage.FileDesc
	closed bool
}

func (fw *fileWrap) Write(p []byte) (n int, err error) {
	fw.fs.syncLock.RLock()
	defer fw.fs.syncLock.RUnlock()
	return fw.File.Write(p)
}

func (fw *fileWrap) Sync() error {
	return fw.fs.sync()
}

func (fw *fileWrap) Close() error {
	fw.fs.mu.Lock()
	defer fw.fs.mu.Unlock()
	if fw.closed {
		return storage.ErrClosed
	}
	fw.closed = true
	fw.fs.open--
	err := fw.File.Close()
	if err != nil {
		fw.fs.log(fmt.Sprintf("close %s: %v", fw.fd, err))
	}
	return err
}

func fsGenName(fd storage.FileDesc) string {
	switch fd.Type {
	case storage.TypeManifest:
		return fmt.Sprintf("MANIFEST-%06d", fd.Num)
	case storage.TypeJournal:
		return fmt.Sprintf("%06d.log", fd.Num)
	case storage.TypeTable:
		return fmt.Sprintf("%06d.ldb", fd.Num)
	case storage.TypeTemp:
		return fmt.Sprintf("%06d.tmp", fd.Num)
	default:
		panic("invalid file type")
	}
}

func fsHasOldName(fd storage.FileDesc) bool {
	return fd.Type == storage.TypeTable
}

func fsGenOldName(fd storage.FileDesc) string {
	switch fd.Type {
	case storage.TypeTable:
		return fmt.Sprintf("%06d.sst", fd.Num)
	default:
		return fsGenName(fd)
	}
}

func fsParseName(name string) (fd storage.FileDesc, ok bool) {
	var tail string
	_, err := fmt.Sscanf(name, "%d.%s", &fd.Num, &tail)
	if err == nil {
		switch tail {
		case "log":
			fd.Type = storage.TypeJournal
		case "ldb", "sst":
			fd.Type = storage.TypeTable
		case "tmp":
			fd.Type = storage.TypeTemp
		default:
			return
		}
		return fd, true
	}
	n, _ := fmt.Sscanf(name, "MANIFEST-%d%s", &fd.Num, &tail)
	if n == 1 {
		fd.Type = storage.TypeManifest
		return fd, true
	}
	return
}

func fsParseNamePtr(name string, fd *storage.FileDesc) bool {
	_fd, ok := fsParseName(name)
	if fd != nil {
		*fd = _fd
	}
	return ok
}
