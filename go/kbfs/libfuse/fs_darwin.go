// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build darwin

package libfuse

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strconv"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/libkbfs"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/utils"
	"golang.org/x/net/context"
)

const (
	// TrashDirName is the .Trashes special directory that macOS uses for Trash
	// on non boot volumes.
	TrashDirName = ".Trashes"

	// FSEventsDirName is the .fseventsd directory that macOS always tries to get.
	// TODO: find out what this is for.
	FSEventsDirName = ".fseventsd"

	// DSStoreFileName is the .DS_Store file
	// TODO: find out if this is necessary
	DSStoreFileName = ".DS_Store"
)

// mountRootSpecialPaths defines automatically handled special paths.
// TrashDirName is notably missing here since we use the *Trash type to handle
// it.
var mountRootSpecialPaths = map[string]bool{
	FSEventsDirName: true,
	DSStoreFileName: true,
}

var platformRootDirs = []fuse.Dirent{
	{
		Type: fuse.DT_Dir,
		Name: TrashDirName,
	},
	{
		Type: fuse.DT_Dir,
		Name: FSEventsDirName,
	},
	{
		Type: fuse.DT_File,
		Name: DSStoreFileName,
	},
}

func (r *Root) platformLookup(ctx context.Context, req *fuse.LookupRequest, resp *fuse.LookupResponse) (fs.Node, error) {
	switch req.Name {
	case VolIconFileName:
		return newExternalBundleResourceFile("KeybaseFolder.icns")
	case ExtendedAttributeSelfFileName:
		return newExternalBundleResourceFile("ExtendedAttributeFinderInfo.bin")
	}

	if r.private.fs.platformParams.UseLocal {
		if mountRootSpecialPaths[req.Name] {
			session, err := idutil.GetCurrentSessionIfPossible(ctx, r.private.fs.config.KBPKI(), false)
			if err != nil {
				return nil, err
			}
			return &Alias{realPath: fmt.Sprintf("private/%s/.darwin/%s", session.Name, req.Name)}, nil
		}

		if req.Name == TrashDirName {
			session, err := idutil.GetCurrentSessionIfPossible(ctx, r.private.fs.config.KBPKI(), false)
			if err != nil {
				return nil, err
			}
			return &Trash{
				fs:         r.private.fs,
				kbusername: session.Name,
			}, nil
		}
	}

	return nil, nil
}

func newExternalBundleResourceFile(path string) (*SpecialReadFile, error) {
	bpath, err := bundleResourcePath(path)
	if err != nil {
		return nil, err
	}
	return newExternalFile(bpath)
}

func bundleResourcePath(path string) (string, error) {
	if runtime.GOOS != "darwin" {
		return "", fmt.Errorf("Bundle resource path only available on macOS/darwin")
	}
	execPath, err := utils.BinPath()
	if err != nil {
		return "", err
	}
	return filepath.Join(execPath, "..", "..", "..", "Resources", path), nil
}

// Trash is a mock .Trashes directory. It implements a /keybase/.Trashes that
// has a $UID inside, which symlinks to a directory within the user's own
// private TLF. Since rename doesn't work across different TLFs, this would be
// a Trash that only works for stuff in user's own private TLF.
//
// TODO: implement per-TLF "trash" location, and have this type figure
// out how to concatenate files from different TLF's trash together, and
// disseminates renames into different TLF's trash.
type Trash struct {
	fs         *FS
	kbusername kbname.NormalizedUsername
}

// Lookup implements the fs.NodeRequestLookuper interface for *Trash
func (t *Trash) Lookup(ctx context.Context,
	req *fuse.LookupRequest, resp *fuse.LookupResponse) (fs.Node, error) {
	if req.Name == strconv.Itoa(os.Getuid()) {
		return &Alias{
			realPath: fmt.Sprintf("../private/%s/.trash", t.kbusername),
		}, nil
	}
	return nil, fuse.ENOENT
}

// Attr implements the fs.Node interface for *Trash
func (t *Trash) Attr(ctx context.Context, a *fuse.Attr) error {
	a.Mode = os.ModeDir | 0755
	return nil
}

// ReadDirAll implements the fs.NodeReadDirAller interface for *Trash
func (t *Trash) ReadDirAll(ctx context.Context) (res []fuse.Dirent, err error) {
	t.fs.log.CDebugf(ctx, "Trash ReadDirAll")
	defer func() { err = t.fs.processError(ctx, libkbfs.ReadMode, err) }()

	return []fuse.Dirent{
		{
			Type: fuse.DT_Link,
			Name: strconv.Itoa(os.Getuid()),
		},
	}, nil
}
