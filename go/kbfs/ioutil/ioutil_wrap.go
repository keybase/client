// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package ioutil

import (
	"io"
	"os"

	ioutil_base "io/ioutil"

	"github.com/pkg/errors"
)

// ReadAll wraps ReadAll from "io/ioutil".
func ReadAll(r io.Reader) ([]byte, error) {
	buf, err := ioutil_base.ReadAll(r)
	if err != nil {
		return nil, errors.Wrapf(
			err, "failed to read all from reader %v", r)
	}

	return buf, nil
}

// ReadDir wraps ReadDir from "io/ioutil".
func ReadDir(dirname string) ([]os.FileInfo, error) {
	list, err := ioutil_base.ReadDir(dirname)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to read dir %q", dirname)
	}

	return list, nil
}

// ReadFile wraps ReadFile from "io/ioutil".
func ReadFile(filename string) ([]byte, error) {
	buf, err := ioutil_base.ReadFile(filename)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to read file %q", filename)
	}
	return buf, nil
}

// TempDir wraps TempDir from "io/ioutil".
func TempDir(dir, prefix string) (name string, err error) {
	name, err = ioutil_base.TempDir(dir, prefix)
	if err != nil {
		return "", errors.Wrapf(err,
			"failed to make temp dir in %q with prefix %q",
			dir, prefix)
	}
	return name, nil
}

// WriteFile wraps WriteFile from "io/ioutil".
func WriteFile(filename string, data []byte, perm os.FileMode) error {
	err := ioutil_base.WriteFile(filename, data, perm)
	if err != nil {
		return errors.Wrapf(err, "failed to write file %q", filename)
	}
	return nil
}
