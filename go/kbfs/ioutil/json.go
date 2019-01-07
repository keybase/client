// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package ioutil

import (
	"encoding/json"
	"path/filepath"

	"github.com/pkg/errors"
)

// TODO: Support unknown fields (probably by using go-codec's JSON
// serializer/deserializer).

// SerializeToJSONFile serializes the given object as JSON and writes
// it to the given file, making its parent directory first if
// necessary.
func SerializeToJSONFile(obj interface{}, path string) error {
	err := MkdirAll(filepath.Dir(path), 0700)
	if err != nil {
		return err
	}

	buf, err := json.Marshal(obj)
	if err != nil {
		return errors.Wrapf(err, "failed to marshal %q as JSON", path)
	}

	return WriteFile(path, buf, 0600)
}

// DeserializeFromJSONFile deserializes the given JSON file into the
// object pointed to by objPtr. It may return an error for which
// ioutil.IsNotExist() returns true.
func DeserializeFromJSONFile(path string, objPtr interface{}) error {
	data, err := ReadFile(path)
	if err != nil {
		return err
	}

	err = json.Unmarshal(data, objPtr)
	if err != nil {
		return errors.Wrapf(err, "failed to unmarshal %q as JSON", path)
	}

	return nil
}
