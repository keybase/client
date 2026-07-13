// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"net/http"
	"os"
	"strings"

	billy "github.com/go-git/go-billy/v5"
	"github.com/pkg/errors"
)

type httpRootFileSystem struct {
	rfs *RootFS
}

var _ http.FileSystem = httpRootFileSystem{}

type fileOnly struct {
	billy.File
	rfs *RootFS
}

// Readdir implements the http.File interface.
func (fo fileOnly) Readdir(count int) ([]os.FileInfo, error) {
	return nil, errors.New("not supported")
}

// Stat implements the http.File interface.
func (fo fileOnly) Stat() (os.FileInfo, error) {
	return fo.rfs.Stat(fo.Name())
}

func (hrfs httpRootFileSystem) Open(filename string) (entry http.File, err error) {
	defer func() {
		if err != nil {
			err = translateErr(err)
		}
	}()

	filename = strings.TrimPrefix(filename, "/")

	f, err := hrfs.rfs.Open(filename)
	if err != nil {
		return nil, err
	}

	return fileOnly{File: f, rfs: hrfs.rfs}, nil
}
