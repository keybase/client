// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package ioutil

import (
	"io"
	"io/fs"
	"os"

	"github.com/pkg/errors"
)

// ReadAll wraps ReadAll from "io".
func ReadAll(r io.Reader) ([]byte, error) {
	buf, err := io.ReadAll(r)
	if err != nil {
		return nil, errors.Wrapf(
			err, "failed to read all from reader %v", r)
	}

	return buf, nil
}

// ReadDir wraps ReadDir from "os".
func ReadDir(dirname string) ([]os.FileInfo, error) {
	entries, err := os.ReadDir(dirname)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to read dir %q", dirname)
	}
	infos := make([]fs.FileInfo, 0, len(entries))
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			return nil, errors.Wrapf(err, "failed to read dir %q", dirname)
		}
		infos = append(infos, info)
	}
	return infos, nil
}

// ReadFile wraps ReadFile from "os".
func ReadFile(filename string) ([]byte, error) {
	buf, err := os.ReadFile(filename)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to read file %q", filename)
	}
	return buf, nil
}

// TempDir wraps MkdirTemp from "os".
func TempDir(dir, prefix string) (name string, err error) {
	name, err = os.MkdirTemp(dir, prefix)
	if err != nil {
		return "", errors.Wrapf(err,
			"failed to make temp dir in %q with prefix %q",
			dir, prefix)
	}
	return name, nil
}

// WriteFile wraps WriteFile from "os".
func WriteFile(filename string, data []byte, perm os.FileMode) error {
	err := os.WriteFile(filename, data, perm)
	if err != nil {
		return errors.Wrapf(err, "failed to write file %q", filename)
	}
	return nil
}
