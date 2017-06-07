// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"strings"
	"time"

	"github.com/keybase/kbfs/dokan"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

const (
	// PublicName is the name of the parent of all public top-level folders.
	PublicName = "public"

	// PrivateName is the name of the parent of all private top-level folders.
	PrivateName = "private"

	// TeamName is the name of the parent of all team top-level folders.
	TeamName = "team"

	// CtxOpID is the display name for the unique operation Dokan ID tag.
	CtxOpID = "DID"

	// WrongUserErrorFileName is the name of error directory for other users.
	WrongUserErrorFileName = `kbfs.access.denied.for.other.windows.users.txt`

	// WrongUserErrorContents is the contents of the file.
	WrongUserErrorContents = `Access to KBFS is limited to the windows user (sid) running KBFS.`
)

// CtxTagKey is the type used for unique context tags
type CtxTagKey int

const (
	// CtxIDKey is the type of the tag for unique operation IDs.
	CtxIDKey CtxTagKey = iota
)

// eiToStat converts from a libkbfs.EntryInfo and error to a *dokan.Stat and error.
// Note that handling symlinks to directories requires extra processing not done here.
func eiToStat(ei libkbfs.EntryInfo, err error) (*dokan.Stat, error) {
	if err != nil {
		return nil, errToDokan(err)
	}
	st := &dokan.Stat{}
	fillStat(st, &ei)
	return st, nil
}

// fillStat fill a dokan.Stat from a libkbfs.DirEntry.
// Note that handling symlinks to directories requires extra processing not done here.
func fillStat(a *dokan.Stat, de *libkbfs.EntryInfo) {
	a.FileSize = int64(de.Size)
	a.LastWrite = time.Unix(0, de.Mtime)
	a.LastAccess = a.LastWrite
	a.Creation = time.Unix(0, de.Ctime)
	switch de.Type {
	case libkbfs.File, libkbfs.Exec:
		a.FileAttributes = dokan.FileAttributeNormal
	case libkbfs.Dir:
		a.FileAttributes = dokan.FileAttributeDirectory
	case libkbfs.Sym:
		a.FileAttributes = dokan.FileAttributeReparsePoint
		a.ReparsePointTag = dokan.IOReparseTagSymlink
	}
}

// errToDokan makes some libkbfs errors easier to digest in dokan. Not needed in most places.
func errToDokan(err error) error {
	switch err.(type) {
	case libkbfs.NoSuchNameError:
		return dokan.ErrObjectNameNotFound
	case libkbfs.NoSuchUserError:
		return dokan.ErrObjectNameNotFound
	case kbfsmd.ServerErrorUnauthorized:
		return dokan.ErrAccessDenied
	case nil:
		return nil
	}
	return err
}

// defaultDirectoryInformation returns default directory information.
func defaultDirectoryInformation() (*dokan.Stat, error) {
	var st dokan.Stat
	st.FileAttributes = dokan.FileAttributeDirectory
	return &st, nil
}

// defaultFileInformation returns default file information.
func defaultFileInformation() (*dokan.Stat, error) {
	var st dokan.Stat
	st.FileAttributes = dokan.FileAttributeNormal
	return &st, nil
}

// defaultSymlinkFileInformation returns default symlink to file information.
func defaultSymlinkFileInformation() (*dokan.Stat, error) {
	var st dokan.Stat
	st.FileAttributes = dokan.FileAttributeReparsePoint
	st.ReparsePointTag = dokan.IOReparseTagSymlink
	return &st, nil
}

// defaultSymlinkDirInformation returns default symlink to directory information.
func defaultSymlinkDirInformation() (*dokan.Stat, error) {
	var st dokan.Stat
	st.FileAttributes = dokan.FileAttributeReparsePoint | dokan.FileAttributeDirectory
	st.ReparsePointTag = dokan.IOReparseTagSymlink
	return &st, nil
}

// lowerTranslateCandidate returns whether a path components
// has a (different) lowercase translation.
func lowerTranslateCandidate(oc *openContext, s string) string {
	if !oc.isUppercasePath {
		return ""
	}
	c := strings.ToLower(s)
	if c == s {
		return ""
	}
	return c
}

func stringReadFile(contents string) dokan.File {
	return &stringFile{data: contents}
}

type stringFile struct {
	emptyFile
	data string
}

// GetFileInformation does stats for dokan.
func (s *stringFile) GetFileInformation(ctx context.Context, fi *dokan.FileInfo) (*dokan.Stat, error) {
	a, err := defaultFileInformation()
	if err != nil {
		return nil, err
	}
	a.FileAttributes |= dokan.FileAttributeReadonly
	a.FileSize = int64(len(s.data))
	t := time.Now()
	a.LastWrite = t
	a.LastAccess = t
	a.Creation = t
	return a, nil
}

// ReadFile does reads for dokan.
func (s *stringFile) ReadFile(ctx context.Context, fi *dokan.FileInfo, bs []byte, offset int64) (int, error) {
	data := s.data
	if offset >= int64(len(data)) {
		return 0, nil
	}

	data = data[int(offset):]

	return copy(bs, data), nil
}
