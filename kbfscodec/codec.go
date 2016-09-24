// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfscodec

import (
	"bytes"
	"reflect"
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

// Update encodes src into a byte string, and then decode it into dst.
func Update(c Codec, dst interface{}, src interface{}) error {
	buf, err := c.Encode(src)
	if err != nil {
		return err
	}
	err = c.Decode(buf, dst)
	if err != nil {
		return err
	}
	return nil
}
