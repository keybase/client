// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package dokan

import (
	"bytes"
	"io"
	"os"
	"strings"
	"sync"
	"syscall"
	"testing"
	"time"
	"unsafe"

	"github.com/keybase/kbfs/dokan/winacl"
	"github.com/keybase/kbfs/ioutil"
	"golang.org/x/net/context"
	"golang.org/x/sys/windows"
)

func TestEmptyFS(t *testing.T) {
	s0 := fsTableStore(emptyFS{}, nil)
	defer fsTableFree(s0)
	fs := newTestFS()
	mnt, err := Mount(&Config{FileSystem: fs, Path: `T:\`})
	if err != nil {
		t.Fatal("Mount failed:", err)
	}
	defer mnt.Close()
	testShouldNotExist(t)
	testHelloTxt(t)
	testRAMFile(t)
	testReaddir(t)
	testPlaceHolderRemoveRename(t)
	testDiskFreeSpace(t)
}

func testShouldNotExist(t *testing.T) {
	_, err := os.Open(`T:\should-not-exist`)
	if !ioutil.IsNotExist(err) {
		t.Fatal("Opening non-existent file:", err)
	}
}

func testHelloTxt(t *testing.T) {
	f, err := os.Open(`T:\hello.txt`)
	if err != nil {
		t.Fatal("Opening hello.txt file:", err)
	}
	defer f.Close()
	bs := make([]byte, 256)
	n, err := f.Read(bs)
	if err != nil {
		t.Fatal("Reading hello.txt file:", err)
	}
	if string(bs[:n]) != helloStr {
		t.Fatal("Read returned wrong bytes:", bs[:n])
	}
	statIsLike(t, f, int64(len(helloStr)), nil)
}

func testRAMFile(t *testing.T) {
	f, err := os.Create(`T:\ram.txt`)
	if err != nil {
		t.Fatal("Opening ram.txt file:", err)
	}
	defer f.Close()
	bs := make([]byte, 256)
	n, err := f.Read(bs)
	if n != 0 || err != io.EOF {
		t.Fatal("Reading empty ram.txt file:", n, err)
	}
	n, err = f.WriteAt([]byte(helloStr), 4)
	if n != len(helloStr) || err != nil {
		t.Fatal("WriteAt ram.txt file:", n, err)
	}
	n, err = f.ReadAt(bs, 4)
	if err != nil && err != io.EOF {
		t.Fatal("ReadAt ram.txt file:", err)
	}
	if string(bs[:n]) != helloStr {
		t.Fatal("ReadAt ram.txt returned wrong bytes:", bs[:n])
	}
	n, err = f.Read(bs)
	if err != nil && err != io.EOF {
		t.Fatal("Reading ram.txt file:", err)
	}
	if string(bs[:n]) != string([]byte{0, 0, 0, 0})+helloStr {
		t.Fatal("Read ram.txt returned wrong bytes:", bs[:n])
	}
	t0 := time.Now()
	statIsLike(t, f, int64(len(helloStr)+4), &t0)
	tp := time.Date(2007, 1, 2, 3, 4, 5, 6, time.UTC)
	ft := syscall.NsecToFiletime(tp.UnixNano())
	err = syscall.SetFileTime(syscall.Handle(f.Fd()), nil, nil, &ft)
	if err != nil {
		t.Fatal("SetFileTime ram.txt file:", err)
	}
	statIsLike(t, f, int64(len(helloStr)+4), &tp)
	testLock(t, f)
	testUnlock(t, f)
	testSync(t, f)
	testTruncate(t, f)
}

func statIsLike(t *testing.T, f *os.File, sz int64, timptr *time.Time) {
	st, err := f.Stat()
	if err != nil {
		t.Fatal("Statting ", f.Name(), err)
	}
	if st.Size() != sz {
		t.Fatal("Size returned wrong size", f.Name(), st.Size(), "vs", len(helloStr))
	}
	if timptr != nil && !isNearTime(*timptr, st.ModTime()) {
		t.Fatal("Modification time returned by stat is wrong", f.Name(), st.ModTime(), "vs", *timptr)
	}
}

func isNearTime(t0, t1 time.Time) bool {
	if t1.Before(t0) {
		t0, t1 = t1, t0
	}
	// TODO consider a less flaky way to do this.
	return t1.Sub(t0) < time.Second
}

var (
	modkernel32 = windows.NewLazySystemDLL("kernel32.dll")

	procLockFile            = modkernel32.NewProc("LockFile")
	procUnlockFile          = modkernel32.NewProc("UnlockFile")
	procGetDiskFreeSpaceExW = modkernel32.NewProc("GetDiskFreeSpaceExW")
)

func testLock(t *testing.T, f *os.File) {
	res, _, err := syscall.Syscall6(procLockFile.Addr(), 5, f.Fd(), 1, 0, 2, 0, 0)
	if res == 0 {
		t.Fatal("LockFile failed with:", err)
	}
}

func testUnlock(t *testing.T, f *os.File) {
	res, _, err := syscall.Syscall6(procUnlockFile.Addr(), 5, f.Fd(), 1, 0, 2, 0, 0)
	if res == 0 {
		t.Fatal("UnlockFile failed with:", err)
	}
}

func testSync(t *testing.T, f *os.File) {
	err := f.Sync()
	if err != nil {
		t.Fatal("Syncing ", f.Name(), err)
	}
}

func testTruncate(t *testing.T, f *os.File) {
	for _, size := range []int64{400, 2, 0, 1, 5, 77, 13} {
		err := f.Truncate(size)
		if err != nil {
			t.Fatal("Truncating ", f.Name(), "to", size, err)
		}
		statIsLike(t, f, size, nil)
	}
}

func testReaddir(t *testing.T) {
	f, err := os.Open(`T:\`)
	if err != nil {
		t.Fatal("Opening root directory:", err)
	}
	defer f.Close()
	debug("Starting readdir")
	fs, err := f.Readdir(-1)
	if err != nil {
		t.Fatal("Readdir root directory:", err)
	}
	if len(fs) != 1 {
		t.Fatal("Readdir root directory element number mismatch: ", len(fs))
	}
	st := fs[0]
	if st.Name() != `hello.txt` {
		t.Fatal("Readdir invalid name:", st.Name())
	}
	if st.Size() != int64(len(helloStr)) {
		t.Fatal("Size returned wrong size:", st.Size(), "vs", len(helloStr))
	}

}

func testPlaceHolderRemoveRename(t *testing.T) {
	ioutil.Remove(`T:\hello.txt`)
	ioutil.Remove(`T:\`)
	ioutil.Rename(`T:\hello.txt`, `T:\does-not-exist2`)
}

func testDiskFreeSpace(t *testing.T) {
	var free, total, totalFree uint64
	ppath := syscall.StringToUTF16Ptr(`T:\`)
	res, _, err := syscall.Syscall6(procGetDiskFreeSpaceExW.Addr(),
		4,
		uintptr(unsafe.Pointer(ppath)),
		uintptr(unsafe.Pointer(&free)),
		uintptr(unsafe.Pointer(&total)),
		uintptr(unsafe.Pointer(&totalFree)), 0, 0)
	if res == 0 {
		t.Fatal("GetDiskFreeSpaceEx failed with:", err)
	}
	if free != testFreeAvail {
		t.Fatalf("GetDiskFreeSpace: %X vs %X", free, uint64(testFreeAvail))
	}
	if total != testTotalBytes {
		t.Fatalf("GetDiskFreeSpace: %X vs %X", total, uint64(testTotalBytes))
	}
	if totalFree != testTotalFree {
		t.Fatalf("GetDiskFreeSpace: %X vs %X", totalFree, uint64(testTotalFree))
	}
}

var _ FileSystem = emptyFS{}

type emptyFS struct{}

func (t emptyFile) GetFileSecurity(ctx context.Context, fi *FileInfo, si winacl.SecurityInformation, sd *winacl.SecurityDescriptor) error {
	debug("emptyFS.GetFileSecurity")
	return nil
}
func (t emptyFile) SetFileSecurity(ctx context.Context, fi *FileInfo, si winacl.SecurityInformation, sd *winacl.SecurityDescriptor) error {
	debug("emptyFS.SetFileSecurity")
	return nil
}
func (t emptyFile) Cleanup(ctx context.Context, fi *FileInfo) {
	debug("emptyFS.Cleanup")
}

func (t emptyFile) CloseFile(ctx context.Context, fi *FileInfo) {
	debug("emptyFS.CloseFile")
}

func (t emptyFS) WithContext(ctx context.Context) (context.Context, context.CancelFunc) {
	return ctx, nil
}

func (t emptyFS) GetVolumeInformation(ctx context.Context) (VolumeInformation, error) {
	debug("emptyFS.GetVolumeInformation")
	return VolumeInformation{}, nil
}

func (t emptyFS) GetDiskFreeSpace(ctx context.Context) (FreeSpace, error) {
	debug("emptyFS.GetDiskFreeSpace")
	return FreeSpace{}, nil
}

func (t emptyFS) ErrorPrint(err error) {
	debug(err)
}

func (t emptyFS) CreateFile(ctx context.Context, fi *FileInfo, cd *CreateData) (File, bool, error) {
	debug("emptyFS.CreateFile")
	return emptyFile{}, true, nil
}
func (t emptyFile) CanDeleteFile(ctx context.Context, fi *FileInfo) error {
	return ErrAccessDenied
}
func (t emptyFile) CanDeleteDirectory(ctx context.Context, fi *FileInfo) error {
	return ErrAccessDenied
}
func (t emptyFile) SetEndOfFile(ctx context.Context, fi *FileInfo, length int64) error {
	debug("emptyFile.SetEndOfFile")
	return nil
}
func (t emptyFile) SetAllocationSize(ctx context.Context, fi *FileInfo, length int64) error {
	debug("emptyFile.SetAllocationSize")
	return nil
}
func (t emptyFS) MoveFile(ctx context.Context, src File, sourceFI *FileInfo, targetPath string, replaceExisting bool) error {
	debug("emptyFS.MoveFile")
	return nil
}
func (t emptyFile) ReadFile(ctx context.Context, fi *FileInfo, bs []byte, offset int64) (int, error) {
	return len(bs), nil
}
func (t emptyFile) WriteFile(ctx context.Context, fi *FileInfo, bs []byte, offset int64) (int, error) {
	return len(bs), nil
}
func (t emptyFile) FlushFileBuffers(ctx context.Context, fi *FileInfo) error {
	debug("emptyFS.FlushFileBuffers")
	return nil
}

type emptyFile struct{}

func (t emptyFile) GetFileInformation(ctx context.Context, fi *FileInfo) (*Stat, error) {
	debug("emptyFile.GetFileInformation")
	var st Stat
	st.FileAttributes = FileAttributeNormal
	return &st, nil
}
func (t emptyFile) FindFiles(context.Context, *FileInfo, string, func(*NamedStat) error) error {
	debug("emptyFile.FindFiles")
	return nil
}
func (t emptyFile) SetFileTime(context.Context, *FileInfo, time.Time, time.Time, time.Time) error {
	debug("emptyFile.SetFileTime")
	return nil
}
func (t emptyFile) SetFileAttributes(ctx context.Context, fi *FileInfo, fileAttributes FileAttribute) error {
	debug("emptyFile.SetFileAttributes")
	return nil
}

func (t emptyFile) LockFile(ctx context.Context, fi *FileInfo, offset int64, length int64) error {
	debug("emptyFile.LockFile")
	return nil
}
func (t emptyFile) UnlockFile(ctx context.Context, fi *FileInfo, offset int64, length int64) error {
	debug("emptyFile.UnlockFile")
	return nil
}

type testFS struct {
	emptyFS
	ramFile *ramFile
}

func newTestFS() *testFS {
	var t testFS
	t.ramFile = newRAMFile()
	return &t
}

func (t *testFS) CreateFile(ctx context.Context, fi *FileInfo, cd *CreateData) (File, bool, error) {
	path := fi.Path()
	debug("testFS.CreateFile", path)
	switch path {
	case `\hello.txt`:
		return testFile{}, false, nil
	case `\ram.txt`:
		return t.ramFile, false, nil
	// SL_OPEN_TARGET_DIRECTORY may get empty paths...
	case `\`, ``:
		if cd.CreateOptions&FileNonDirectoryFile != 0 {
			return nil, true, ErrFileIsADirectory
		}
		return testDir{}, true, nil
	}
	return nil, false, ErrObjectNameNotFound
}
func (t *testFS) GetDiskFreeSpace(ctx context.Context) (FreeSpace, error) {
	debug("testFS.GetDiskFreeSpace")
	return FreeSpace{
		FreeBytesAvailable:     testFreeAvail,
		TotalNumberOfBytes:     testTotalBytes,
		TotalNumberOfFreeBytes: testTotalFree,
	}, nil
}

const (
	// Windows mangles the last bytes of GetDiskFreeSpaceEx
	// because of GetDiskFreeSpace and sectors...
	testFreeAvail  = 0xA234567887654000
	testTotalBytes = 0xB234567887654000
	testTotalFree  = 0xC234567887654000
)

type testDir struct {
	emptyFile
}

const helloStr = "hello world\r\n"

func (t testDir) FindFiles(ctx context.Context, fi *FileInfo, p string, cb func(*NamedStat) error) error {
	debug("testDir.FindFiles")
	st := NamedStat{}
	st.Name = "hello.txt"
	st.FileSize = int64(len(helloStr))
	return cb(&st)
}
func (t testDir) GetFileInformation(ctx context.Context, fi *FileInfo) (*Stat, error) {
	debug("testDir.GetFileInformation")
	return &Stat{
		FileAttributes: FileAttributeDirectory,
	}, nil
}

type testFile struct {
	emptyFile
}

func (t testFile) GetFileInformation(ctx context.Context, fi *FileInfo) (*Stat, error) {
	debug("testFile.GetFileInformation")
	return &Stat{
		FileSize: int64(len(helloStr)),
	}, nil
}
func (t testFile) ReadFile(ctx context.Context, fi *FileInfo, bs []byte, offset int64) (int, error) {
	debug("testFile.ReadFile")
	rd := strings.NewReader(helloStr)
	return rd.ReadAt(bs, offset)
}

type ramFile struct {
	emptyFile
	lock          sync.Mutex
	creationTime  time.Time
	lastReadTime  time.Time
	lastWriteTime time.Time
	contents      []byte
}

func newRAMFile() *ramFile {
	var r ramFile
	r.creationTime = time.Now()
	r.lastReadTime = r.creationTime
	r.lastWriteTime = r.creationTime
	return &r
}

func (r *ramFile) GetFileInformation(ctx context.Context, fi *FileInfo) (*Stat, error) {
	debug("ramFile.GetFileInformation")
	r.lock.Lock()
	defer r.lock.Unlock()
	return &Stat{
		FileSize:   int64(len(r.contents)),
		LastAccess: r.lastReadTime,
		LastWrite:  r.lastWriteTime,
		Creation:   r.creationTime,
	}, nil
}

func (r *ramFile) ReadFile(ctx context.Context, fi *FileInfo, bs []byte, offset int64) (int, error) {
	debug("ramFile.ReadFile")
	r.lock.Lock()
	defer r.lock.Unlock()
	r.lastReadTime = time.Now()
	rd := bytes.NewReader(r.contents)
	return rd.ReadAt(bs, offset)
}

func (r *ramFile) WriteFile(ctx context.Context, fi *FileInfo, bs []byte, offset int64) (int, error) {
	debug("ramFile.WriteFile")
	r.lock.Lock()
	defer r.lock.Unlock()
	r.lastWriteTime = time.Now()
	maxl := len(r.contents)
	if int(offset)+len(bs) > maxl {
		maxl = int(offset) + len(bs)
		r.contents = append(r.contents, make([]byte, maxl-len(r.contents))...)
	}
	n := copy(r.contents[int(offset):], bs)
	return n, nil
}
func (r *ramFile) SetFileTime(ctx context.Context, fi *FileInfo, creationTime time.Time, lastReadTime time.Time, lastWriteTime time.Time) error {
	debug("ramFile.SetFileTime")
	r.lock.Lock()
	defer r.lock.Unlock()
	if !lastWriteTime.IsZero() {
		r.lastWriteTime = lastWriteTime
	}
	return nil
}
func (r *ramFile) SetEndOfFile(ctx context.Context, fi *FileInfo, length int64) error {
	debug("ramFile.SetEndOfFile")
	r.lock.Lock()
	defer r.lock.Unlock()
	r.lastWriteTime = time.Now()
	switch {
	case int(length) < len(r.contents):
		r.contents = r.contents[:int(length)]
	case int(length) > len(r.contents):
		r.contents = append(r.contents, make([]byte, int(length)-len(r.contents))...)
	}
	return nil
}
func (r *ramFile) SetAllocationSize(ctx context.Context, fi *FileInfo, length int64) error {
	debug("ramFile.SetAllocationSize")
	r.lock.Lock()
	defer r.lock.Unlock()
	r.lastWriteTime = time.Now()
	switch {
	case int(length) < len(r.contents):
		r.contents = r.contents[:int(length)]
	}
	return nil
}
