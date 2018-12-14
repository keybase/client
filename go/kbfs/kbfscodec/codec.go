// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfscodec

import (
	"bytes"
	"path/filepath"
	"reflect"

	"github.com/keybase/kbfs/ioutil"
)

// ExtCode is used to register codec extensions
type ExtCode uint64

// these track the start of a range of unique ExtCodes for various
// types of extensions.
const (
	ExtCodeOpsRangeStart  = 1
	ExtCodeListRangeStart = 101
)

// Codec encodes and decodes arbitrary data
type Codec interface {
	// Decode unmarshals the given buffer into the given object, if possible.
	Decode(buf []byte, obj interface{}) error
	// Encode marshals the given object into a returned buffer.
	Encode(obj interface{}) ([]byte, error)
	// RegisterType should be called for all types that are stored
	// under ambiguous types (like interface{} or nil interface) in a
	// struct that will be encoded/decoded by the codec.  Each must
	// have a unique ExtCode.  Types that include other extension
	// types are not supported.
	RegisterType(rt reflect.Type, code ExtCode)
	// RegisterIfaceSliceType should be called for all encoded slices
	// that contain ambiguous interface types.  Each must have a
	// unique ExtCode.  Slice element types that include other
	// extension types are not supported.
	//
	// If non-nil, typer is used to do a type assertion during
	// decoding, to convert the encoded value into the value expected
	// by the rest of the code.  This is needed, for example, when the
	// codec cannot decode interface types to their desired pointer
	// form.
	RegisterIfaceSliceType(rt reflect.Type, code ExtCode,
		typer func(interface{}) reflect.Value)
}

// Equal returns whether or not the given objects serialize to the
// same byte string. x or y (or both) can be nil.
func Equal(c Codec, x, y interface{}) (bool, error) {
	xBuf, err := c.Encode(x)
	if err != nil {
		return false, err
	}
	yBuf, err := c.Encode(y)
	if err != nil {
		return false, err
	}
	return bytes.Equal(xBuf, yBuf), nil
}

// Update encodes src into a byte string, and then decode it into the
// object pointed to by dstPtr.
func Update(c Codec, dstPtr interface{}, src interface{}) error {
	buf, err := c.Encode(src)
	if err != nil {
		return err
	}
	err = c.Decode(buf, dstPtr)
	if err != nil {
		return err
	}
	return nil
}

// SerializeToFile serializes the given object and writes it to the
// given file, making its parent directory first if necessary.
func SerializeToFile(c Codec, obj interface{}, path string) error {
	err := ioutil.MkdirAll(filepath.Dir(path), 0700)
	if err != nil {
		return err
	}

	buf, err := c.Encode(obj)
	if err != nil {
		return err
	}

	return ioutil.WriteSerializedFile(path, buf, 0600)
}

// SerializeToFileIfNotExist is like SerializeToFile, but does nothing
// if the file already exists.
func SerializeToFileIfNotExist(c Codec, obj interface{}, path string) error {
	_, err := ioutil.Stat(path)
	if ioutil.IsExist(err) {
		return nil
	} else if ioutil.IsNotExist(err) {
		// Continue.
	} else if err != nil {
		return err
	}

	return SerializeToFile(c, obj, path)
}

// DeserializeFromFile deserializes the given file into the object
// pointed to by objPtr. It may return an error for which
// ioutil.IsNotExist() returns true.
func DeserializeFromFile(c Codec, path string, objPtr interface{}) error {
	data, err := ioutil.ReadFile(path)
	if err != nil {
		return err
	}

	err = c.Decode(data, objPtr)
	if err != nil {
		return err
	}

	return nil
}
