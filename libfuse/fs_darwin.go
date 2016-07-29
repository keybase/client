// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfuse

import (
	"fmt"
	"path/filepath"
	"runtime"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/kardianos/osext"
	"golang.org/x/net/context"
)

func (r *Root) platformLookup(ctx context.Context, req *fuse.LookupRequest, resp *fuse.LookupResponse) (fs.Node, error) {
	switch req.Name {
	case VolIconFileName:
		return newExternalBundleResourceFile("KeybaseFolder.icns")
	case ExtendedAttributeSelfFileName:
		return newExternalBundleResourceFile("ExtendedAttributeFinderInfo.bin")
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
	execPath, err := osext.Executable()
	if err != nil {
		return "", err
	}
	return filepath.Join(execPath, "..", "..", "..", "Resources", path), nil
}
