// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package dokan

import (
	"strings"
	"syscall"
	"testing"
	"time"
)

func TestEmptyFS(t *testing.T) {
	s0 := fsTableStore(errorFS{})
	defer fsTableFree(s0)
	fs := testFS{}
	go Mount(fs, 'M')
	time.Sleep(time.Second * 30)
	Unmount('M')
}

var _ FileSystem = errorFS{}

type errorFS struct{}

func (errorFS) Error() string {
	return "errorFS: error!"
}

func (t errorFS) Cleanup(fi *FileInfo) {}
func (t errorFS) CloseFile(*FileInfo)  {}

func (t errorFS) GetVolumeInformation() (VolumeInformation, error) {
	return VolumeInformation{}, t
}

func (t errorFS) GetDiskFreeSpace() (FreeSpace, error) {
	return FreeSpace{}, t
}
func (t errorFS) FlushFileBuffers(*FileInfo) error {
	return t
}
func (t errorFS) CanDeleteFile(*FileInfo) error {
	return t
}
func (t errorFS) CanDeleteDirectory(*FileInfo) error {
	return t
}
func (t errorFS) CreateFile(fi *FileInfo, cd *CreateData) (File, bool, error) {
	return nil, true, t
}
func (t errorFS) ReadFile(fi *FileInfo, bs []byte, offset int64) (int, error)              { return 0, t }
func (t errorFS) WriteFile(fi *FileInfo, bs []byte, offset int64) (int, error)             { return 0, t }
func (t errorFS) SetFileTime(*FileInfo, time.Time, time.Time, time.Time) error             { return t }
func (t errorFS) SetFileAttributes(fi *FileInfo, fileAttributes uint32) error              { return t }
func (t errorFS) SetEndOfFile(fi *FileInfo, length int64) error                            { return t }
func (t errorFS) MoveFile(source *FileInfo, targetPath string, replaceExisting bool) error { return t }
func (t errorFS) Mounted() error                                                           { return t }

var _ FileSystem = emptyFS{}

type emptyFS struct{}

func (t emptyFile) Cleanup(fi *FileInfo) {
	debug("emptyFS.Cleanup")
}

func (t emptyFile) CloseFile(*FileInfo) {
	debug("emptyFS.CloseFile")
}

func (t emptyFS) GetVolumeInformation() (VolumeInformation, error) {
	debug("emptyFS.GetVolumeInformation")
	return VolumeInformation{}, nil
}

func (t emptyFS) GetDiskFreeSpace() (FreeSpace, error) {
	debug("emptyFS.GetDiskFreeSpace")
	return FreeSpace{}, nil
}
func (t emptyFS) CreateFile(fi *FileInfo, cd *CreateData) (File, bool, error) {
	debug("emptyFS.CreateFile")
	return emptyFile{}, true, nil
}
func (t emptyFS) CanDeleteFile(*FileInfo) error {
	return nil
}
func (t emptyFS) CanDeleteDirectory(*FileInfo) error {
	return nil
}
func (t emptyFile) SetEndOfFile(fi *FileInfo, length int64) error {
	debug("emptyFile.SetEndOfFile")
	return nil
}
func (t emptyFS) MoveFile(source *FileInfo, targetPath string, replaceExisting bool) error {
	debug("emptyFS.MoveFile")
	return nil
}
func (t emptyFile) ReadFile(fi *FileInfo, bs []byte, offset int64) (int, error)  { return len(bs), nil }
func (t emptyFile) WriteFile(fi *FileInfo, bs []byte, offset int64) (int, error) { return len(bs), nil }
func (t emptyFile) FlushFileBuffers(*FileInfo) error {
	debug("emptyFS.FlushFileBuffers")
	return nil
}
func (t emptyFS) Mounted() error {
	debug("emptyFS.Mounted")
	return nil
}

type emptyFile struct{}

func (t emptyFile) GetFileInformation(*FileInfo) (*Stat, error) {
	debug("emptyFile.GetFileInformation")
	return &Stat{}, nil
}
func (t emptyFile) FindFiles(*FileInfo, func(*NamedStat) error) error {
	debug("emptyFile.FindFiles")
	return nil
}
func (t emptyFile) SetFileTime(*FileInfo, time.Time, time.Time, time.Time) error {
	debug("emptyFile.SetFileTime")
	return nil
}
func (t emptyFile) SetFileAttributes(fi *FileInfo, fileAttributes uint32) error {
	debug("emptyFile.SetFileAttributes")
	return nil
}

func (t emptyFile) LockFile(fi *FileInfo, offset int64, length int64) error {
	debug("emptyFile.LockFile")
	return nil
}
func (t emptyFile) UnlockFile(fi *FileInfo, offset int64, length int64) error {
	debug("emptyFile.UnlockFile")
	return nil
}

type testFS struct {
	emptyFS
}

func (t testFS) CreateFile(fi *FileInfo, cd *CreateData) (File, bool, error) {
	path := fi.Path()
	debug("testFS.CreateFile", path)
	switch path {
	case `\hello.txt`:
		return testFile{}, false, nil
	case `\`:
		return testDir{}, true, nil
	}
	return nil, false, ErrObjectNameNotFound
}

type testFile struct {
	emptyFile
}
type testDir struct {
	emptyFile
}

const helloStr = "hello world\r\n"

func (t testDir) FindFiles(fi *FileInfo, cb func(*NamedStat) error) error {
	debug("testDir.FindFiles")
	st := NamedStat{}
	st.Name = "hello.txt"
	st.FileSize = int64(len(helloStr))
	return cb(&st)
}
func (t testDir) GetFileInformation(*FileInfo) (*Stat, error) {
	debug("testFile.GetFileInformation")
	return &Stat{
		FileAttributes: syscall.FILE_ATTRIBUTE_DIRECTORY,
		NumberOfLinks:  1,
	}, nil
}
func (t testFile) GetFileInformation(*FileInfo) (*Stat, error) {
	debug("testFile.GetFileInformation")
	return &Stat{
		FileSize:      int64(len(helloStr)),
		NumberOfLinks: 1,
	}, nil
}
func (t testFile) ReadFile(fi *FileInfo, bs []byte, offset int64) (int, error) {
	debug("testFile.ReadFile")
	rd := strings.NewReader(helloStr)
	return rd.ReadAt(bs, offset)
}
